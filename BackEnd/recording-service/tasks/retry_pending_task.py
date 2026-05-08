"""
Auto-recovery task for recordings that failed due to API/subscription issues.

Runs every 1 hour via Celery beat. Looks for recordings with
processing_status='needs_retry', tests if the API works now, and re-runs
the missing steps (transcription, summary, mindmap, subtitles) using the
cached audio.wav from S3.

Max 24 retry attempts (1 day of hourly retries) before marking
processing_status='permanently_failed'.
"""
import os
import logging
import tempfile
from datetime import datetime
from celery import shared_task

logger = logging.getLogger(__name__)

MAX_RETRY_ATTEMPTS = 24


@shared_task(name="retry_pending_recordings")
def retry_pending_recordings():
    """
    Find recordings stuck in needs_retry state and try to recover them.

    Called by Celery beat every 1 hour.
    """
    logger.info("=" * 60)
    logger.info("[RETRY] retry_pending_recordings task started")
    logger.info("=" * 60)

    try:
        from video_processing.recordings import (
            collection,
            client as openai_client,
            groq_client,
            download_from_s3,
            upload_to_aws_s3,
            split_text_into_timed_segments,
            translate_segments_batch,
            translate_segments_to_target_lang,
            create_srt_from_segments,
            summarize_segment,
            sanitize_dot_code,
            enhance_dot_styling,
            generate_graph,
            save_docx,
            save_trainer_evaluation_docx,
            analyze_trainer_performance,
            send_recording_completion_notifications,
            build_s3_document_path,
            get_meeting_type,
            AWS_S3_BUCKET,
            AWS_REGION,
            clean_garbage_scripts,
            remove_repetitions,
        )
    except Exception as import_error:
        logger.error(f"[RETRY] Failed to import recording module: {import_error}")
        return {"status": "error", "reason": str(import_error)}

    pending = list(collection.find({"processing_status": "needs_retry"}))
    logger.info(f"[RETRY] Found {len(pending)} recording(s) needing retry")

    if not pending:
        return {"status": "success", "processed": 0}

    if not _test_apis_working(openai_client, groq_client):
        logger.warning("[RETRY] APIs still not working — incrementing retry counts and skipping")
        for rec in pending:
            new_count = (rec.get("retry_count") or 0) + 1
            update = {
                "retry_count": new_count,
                "last_retry_at": datetime.now()
            }
            if new_count >= MAX_RETRY_ATTEMPTS:
                update["processing_status"] = "permanently_failed"
                update["permanently_failed_at"] = datetime.now()
                logger.error(
                    f"[RETRY] Recording {rec.get('meeting_id')} hit max retries "
                    f"({MAX_RETRY_ATTEMPTS}) — marked permanently_failed"
                )
            collection.update_one({"_id": rec["_id"]}, {"$set": update})
        return {"status": "success", "processed": 0, "skipped_apis_down": len(pending)}

    logger.info("[RETRY] APIs are working — processing pending recordings")

    succeeded = 0
    failed = 0

    for rec in pending:
        meeting_id = rec.get("meeting_id")
        session_id = rec.get("session_id")
        user_id = rec.get("user_id")
        retry_count = rec.get("retry_count") or 0

        if retry_count >= MAX_RETRY_ATTEMPTS:
            collection.update_one(
                {"_id": rec["_id"]},
                {"$set": {
                    "processing_status": "permanently_failed",
                    "permanently_failed_at": datetime.now()
                }}
            )
            logger.error(f"[RETRY] meeting={meeting_id} exceeded max retries — marked permanently_failed")
            failed += 1
            continue

        logger.info(f"[RETRY] ===== Processing meeting={meeting_id} session={session_id} (attempt {retry_count + 1}/{MAX_RETRY_ATTEMPTS}) =====")

        try:
            success = _recover_recording(rec)
            if success:
                succeeded += 1
                logger.info(f"[RETRY] ✅ meeting={meeting_id} fully recovered")
            else:
                collection.update_one(
                    {"_id": rec["_id"]},
                    {"$set": {
                        "retry_count": retry_count + 1,
                        "last_retry_at": datetime.now()
                    }}
                )
                failed += 1
                logger.warning(f"[RETRY] ❌ meeting={meeting_id} recovery failed (will retry next hour)")
        except Exception as e:
            logger.error(f"[RETRY] meeting={meeting_id} crashed during recovery: {e}", exc_info=True)
            collection.update_one(
                {"_id": rec["_id"]},
                {"$set": {
                    "retry_count": retry_count + 1,
                    "last_retry_at": datetime.now()
                }}
            )
            failed += 1

    logger.info(f"[RETRY] Done. Succeeded: {succeeded}, Failed: {failed}")
    return {"status": "success", "processed": succeeded, "failed": failed}


def _test_apis_working(openai_client, groq_client) -> bool:
    """Test if both OpenAI and Groq APIs are responsive."""
    if openai_client is None:
        logger.warning("[RETRY] OpenAI client is None")
        return False
    if groq_client is None:
        logger.warning("[RETRY] Groq client is None")
        return False

    try:
        openai_client.models.list()
        logger.info("[RETRY] ✅ OpenAI API working")
    except Exception as e:
        logger.warning(f"[RETRY] OpenAI API still failing: {e}")
        return False

    try:
        groq_client.models.list()
        logger.info("[RETRY] ✅ Groq API working")
    except Exception as e:
        logger.warning(f"[RETRY] Groq API still failing: {e}")
        return False

    return True


def _recover_recording(rec) -> bool:
    """
    Recover a single recording by re-running missing steps using cached audio.

    Returns True if fully recovered, False otherwise.
    """
    from video_processing.recordings import (
        collection,
        client as openai_client,
        groq_client,
        download_from_s3,
        upload_to_aws_s3,
        split_text_into_timed_segments,
        translate_segments_batch,
        translate_segments_to_target_lang,
        create_srt_from_segments,
        summarize_segment,
        sanitize_dot_code,
        enhance_dot_styling,
        generate_graph,
        save_docx,
        save_trainer_evaluation_docx,
        analyze_trainer_performance,
        send_recording_completion_notifications,
        build_s3_document_path,
        get_meeting_type,
        AWS_S3_BUCKET,
        clean_garbage_scripts,
        remove_repetitions,
    )
    import re

    meeting_id = rec.get("meeting_id")
    session_id = rec.get("session_id")
    user_id = rec.get("user_id")
    audio_s3_key = rec.get("audio_s3_key")
    duration = rec.get("duration", 0)

    if not audio_s3_key:
        logger.error(f"[RETRY] meeting={meeting_id} has no audio_s3_key — cannot recover")
        return False

    workdir = tempfile.mkdtemp(prefix="retry_")
    audio_path = os.path.join(workdir, "audio.wav")

    try:
        logger.info(f"[RETRY] Downloading cached audio from {audio_s3_key}")
        if not download_from_s3(audio_s3_key, audio_path):
            logger.error(f"[RETRY] Failed to download cached audio")
            return False

        audio_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
        logger.info(f"[RETRY] Audio downloaded ({audio_size_mb:.1f} MB)")

        # ===== STEP 1: Transcribe =====
        logger.info(f"[RETRY] Running transcription...")
        segments = _retry_transcribe(audio_path, workdir, openai_client)
        if not segments:
            logger.warning(f"[RETRY] Transcription returned no segments")
            return False
        logger.info(f"[RETRY] ✅ Transcription succeeded ({len(segments)} segments)")

        # Build transcript text
        transcript_text = " ".join(s.get("text", "").strip() for s in segments if s.get("text", "").strip())
        if len(transcript_text) < 20:
            logger.warning(f"[RETRY] Transcript too short ({len(transcript_text)} chars)")
            return False

        meeting_type = get_meeting_type(meeting_id)

        # ===== STEP 2: Generate summary =====
        logger.info(f"[RETRY] Generating summary...")
        summary = summarize_segment(transcript_text)
        if "Summary generation failed" in summary or "Summary unavailable" in summary:
            logger.warning(f"[RETRY] Summary generation failed")
            return False
        logger.info(f"[RETRY] ✅ Summary generated ({len(summary)} chars)")

        # ===== STEP 3: Generate mindmap =====
        logger.info(f"[RETRY] Generating mindmap...")
        image_url = None
        mindmap_png_path = None
        try:
            dot_match = re.search(r"```(?:dot|graphviz)?\s*(.*?)```", summary, re.DOTALL | re.IGNORECASE)
            dot_code = None
            if dot_match:
                raw_dot = dot_match.group(1).strip()
                if "digraph" in raw_dot.lower() or "graph" in raw_dot.lower():
                    dot_code = raw_dot

            if not dot_code:
                m = re.search(r"(digraph\s+\w+\s*\{[\s\S]*?\n\})", summary, re.IGNORECASE)
                if m:
                    dot_code = m.group(1)

            if dot_code:
                dot_code = sanitize_dot_code(dot_code)
                dot_code = enhance_dot_styling(dot_code)
                mindmap_png_path = os.path.join(workdir, "mindmap.png")
                generate_graph(dot_code, mindmap_png_path[:-4])

                if session_id:
                    mindmap_s3_key = f"{meeting_id}/{session_id}/mindmap.png"
                else:
                    mindmap_s3_key = f"{meeting_id}/{user_id}/mindmap.png"
                image_url = upload_to_aws_s3(mindmap_png_path, mindmap_s3_key)
                logger.info(f"[RETRY] ✅ Mindmap generated and uploaded")
        except Exception as mm_err:
            logger.warning(f"[RETRY] Mindmap generation failed (non-fatal): {mm_err}")

        # ===== STEP 4: Save transcript and summary docx =====
        transcript_path = os.path.join(workdir, "transcript.docx")
        save_docx(transcript_text, transcript_path, title="Meeting Transcript")
        transcript_s3_key = build_s3_document_path(meeting_id, user_id, meeting_type, "transcript", session_id=session_id)
        transcript_url = upload_to_aws_s3(transcript_path, transcript_s3_key)
        logger.info(f"[RETRY] ✅ Transcript uploaded")

        summary_path = os.path.join(workdir, "summary.docx")
        save_docx(
            summary,
            summary_path,
            image_path=mindmap_png_path if mindmap_png_path and os.path.exists(mindmap_png_path) else None,
            title="Meeting Summary"
        )
        summary_s3_key = build_s3_document_path(meeting_id, user_id, meeting_type, "summary", session_id=session_id)
        summary_url = upload_to_aws_s3(summary_path, summary_s3_key)
        logger.info(f"[RETRY] ✅ Summary uploaded")

        # ===== STEP 5: Generate subtitles =====
        logger.info(f"[RETRY] Generating subtitles...")
        subtitle_urls = {}
        for lang in ["en", "hi", "te"]:
            try:
                if lang == "en":
                    translated = segments.copy()
                else:
                    translated = translate_segments_to_target_lang(segments, lang)
                if translated:
                    srt_path = os.path.join(workdir, f"subs_{lang}.srt")
                    create_srt_from_segments(translated, srt_path)
                    if os.path.exists(srt_path) and os.path.getsize(srt_path) > 0:
                        subs_folder = build_s3_document_path(meeting_id, user_id, meeting_type, "subtitles", session_id=session_id)
                        if session_id:
                            srt_key = f"{subs_folder}/{meeting_id}_{session_id}_{lang}.srt"
                        else:
                            srt_key = f"{subs_folder}/{meeting_id}_{user_id}_{lang}.srt"
                        url = upload_to_aws_s3(srt_path, srt_key)
                        if url:
                            subtitle_urls[lang] = url
                            logger.info(f"[RETRY] ✅ {lang} subtitles uploaded")
            except Exception as sub_err:
                logger.warning(f"[RETRY] {lang} subtitle generation failed (non-fatal): {sub_err}")

        # ===== STEP 6: Trainer evaluation =====
        logger.info(f"[RETRY] Running trainer evaluation...")
        trainer_evaluation = {}
        trainer_eval_url = None
        try:
            trainer_evaluation = analyze_trainer_performance(transcript_text)
            if trainer_evaluation and not trainer_evaluation.get("error"):
                eval_path = os.path.join(workdir, "trainer_evaluation.docx")
                save_trainer_evaluation_docx(trainer_evaluation, eval_path, meeting_title=f"Meeting {meeting_id}")
                if os.path.exists(eval_path):
                    eval_key = build_s3_document_path(meeting_id, user_id, meeting_type, "trainer_evaluation", session_id=session_id)
                    trainer_eval_url = upload_to_aws_s3(eval_path, eval_key)
                    logger.info(f"[RETRY] ✅ Trainer evaluation uploaded")
        except Exception as eval_err:
            logger.warning(f"[RETRY] Trainer eval failed (non-fatal): {eval_err}")

        # ===== STEP 7: Update MongoDB =====
        update = {
            "processing_status": "completed",
            "transcript_url": transcript_url,
            "summary_url": summary_url,
            "summary_text": summary,
            "image_url": image_url,
            "subtitles": subtitle_urls,
            "subtitle_languages": list(subtitle_urls.keys()),
            "trainer_evaluation": trainer_evaluation if trainer_evaluation else {},
            "trainer_evaluation_url": trainer_eval_url,
            "transcription_available": bool(transcript_url),
            "summary_available": bool(summary_url),
            "recovered_at": datetime.now(),
            "recovered_from_retry": True,
        }
        collection.update_one({"_id": rec["_id"]}, {"$set": update, "$unset": {"retry_reason": ""}})
        logger.info(f"[RETRY] ✅ MongoDB updated")

        # ===== STEP 8: Send recovery notification =====
        try:
            video_url = rec.get("video_url")
            _send_recovery_notification(meeting_id, video_url, transcript_url, summary_url)
        except Exception as notif_err:
            logger.warning(f"[RETRY] Notification failed (non-fatal): {notif_err}")

        # ===== STEP 9: Cleanup cached audio (best-effort, may fail if IAM lacks delete permission) =====
        try:
            import boto3
            cleanup_s3 = boto3.client('s3', region_name='ap-south-1')
            cleanup_s3.delete_object(Bucket=AWS_S3_BUCKET, Key=audio_s3_key)
            logger.info(f"[RETRY] 🧹 Cleaned up cached audio: {audio_s3_key}")
        except Exception as cleanup_err:
            err_str = str(cleanup_err)
            if "AccessDenied" in err_str or "explicit deny" in err_str:
                logger.info(f"[RETRY] ℹ️ Cached audio cleanup skipped (IAM doesn't allow delete; use S3 lifecycle policy instead): {audio_s3_key}")
            else:
                logger.warning(f"[RETRY] ⚠️ Audio cleanup failed (non-fatal): {cleanup_err}")

        return True

    finally:
        try:
            import shutil
            shutil.rmtree(workdir, ignore_errors=True)
        except Exception:
            pass


def _retry_transcribe(audio_path, workdir, openai_client):
    """Re-run OpenAI transcription on cached audio. Simplified version."""
    import subprocess
    from video_processing.recordings import (
        split_text_into_timed_segments,
        translate_segments_batch,
        clean_garbage_scripts,
        remove_repetitions,
    )

    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
            capture_output=True, text=True, timeout=30
        )
        total_duration = float(probe.stdout.strip())
    except Exception:
        total_duration = 60.0

    chunk_sec = 5 * 60
    offset = 0.0
    all_segments = []

    chunk_idx = 0
    while offset < total_duration:
        start_sec = offset
        chunk_path = os.path.join(workdir, f"retry_chunk_{chunk_idx}.wav")
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-ss", str(start_sec), "-i", audio_path,
                 "-t", str(chunk_sec), "-c", "copy", chunk_path],
                check=True, capture_output=True, timeout=120
            )
        except Exception as e:
            logger.error(f"[RETRY] ffmpeg chunk extract failed: {e}")
            offset += chunk_sec
            chunk_idx += 1
            continue

        chunk_duration_sec = min(chunk_sec, total_duration - start_sec)

        try:
            with open(chunk_path, "rb") as f:
                result = openai_client.audio.transcriptions.create(
                    model="gpt-4o-transcribe",
                    file=f,
                    response_format="json",
                    temperature=0.0,
                )
            chunk_text = (getattr(result, "text", "") or "").strip()
            chunk_text = clean_garbage_scripts(chunk_text)
            chunk_text = remove_repetitions(chunk_text)

            if chunk_text and len(chunk_text) >= 10:
                chunk_segments = split_text_into_timed_segments(
                    chunk_text, chunk_start=offset, chunk_duration=chunk_duration_sec
                )
                if chunk_segments:
                    chunk_segments = translate_segments_batch(chunk_segments, "mixed")
                    all_segments.extend(chunk_segments)
        except Exception as e:
            logger.error(f"[RETRY] Chunk {chunk_idx} transcription failed: {e}")

        try:
            os.remove(chunk_path)
        except Exception:
            pass

        offset += chunk_sec
        chunk_idx += 1

    return all_segments


def _send_recovery_notification(meeting_id, video_url, transcript_url, summary_url):
    """Send 'recording_recovered' notification to all participants."""
    from django.db import connection
    from clients.notification_client import (
        ensure_notification_tables,
        _get_recording_meeting_info,
        _get_recording_participants,
        short_id,
    )
    import pytz

    try:
        ensure_notification_tables()
    except Exception as e:
        logger.warning(f"[RETRY] notification tables setup failed: {e}")
        return

    info = _get_recording_meeting_info(meeting_id)
    meeting_title = info.get("title") or f"Meeting {meeting_id[:8]}"
    participants = _get_recording_participants(meeting_id)
    if not participants:
        return

    seen = set()
    unique_emails = []
    for p in participants:
        email = (p.get("email", "") if isinstance(p, dict) else p)
        if email and "@" in str(email):
            norm = str(email).strip().lower()
            if norm not in seen:
                seen.add(norm)
                unique_emails.append(norm)

    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)

    title = "Recording Recovery Complete"
    message = (
        f"<b>Good news!</b> Your recording's transcript, summary, and mind map are now ready.<br><br>"
        f"<b>Meeting:</b> {meeting_title}<br><br>"
        f"<i>Click here to view the updated recording in your dashboard.</i>"
    )

    for email in unique_emails:
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO tbl_Notifications
                    (id, recipient_email, meeting_id, notification_type, title, message,
                     meeting_title, meeting_url, is_read, priority, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, [
                    short_id(),
                    email,
                    str(meeting_id),
                    "recording_recovered",
                    title,
                    message,
                    meeting_title,
                    video_url,
                    False,
                    "normal",
                    now
                ])
                connection.commit()
        except Exception as e:
            logger.warning(f"[RETRY] Notification insert failed for {email}: {e}")
