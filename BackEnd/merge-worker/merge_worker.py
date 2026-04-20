"""
iMeetPro Cloud Merge Worker
Runs on AWS ECS Fargate — polls SQS for merge requests,
downloads video + audio from S3, merges with FFmpeg,
uploads merged file to S3, sends result to SQS results queue.
"""

import os
import sys
import json
import time
import boto3
import subprocess
import logging
from tempfile import TemporaryDirectory

# ==================== LOGGING ====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("merge-worker")

# ==================== CONFIG ====================
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "imeetpro-005572111409")
SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL", "")
SQS_RESULTS_QUEUE_URL = os.getenv("SQS_RESULTS_QUEUE_URL", "")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))

if not SQS_QUEUE_URL:
    logger.error("❌ SQS_QUEUE_URL not set!")
    sys.exit(1)

if not SQS_RESULTS_QUEUE_URL:
    logger.error("❌ SQS_RESULTS_QUEUE_URL not set!")
    sys.exit(1)

# ==================== AWS CLIENTS ====================
s3_client = boto3.client("s3", region_name=AWS_REGION)
sqs_client = boto3.client("sqs", region_name=AWS_REGION)

logger.info(f"🚀 iMeetPro Merge Worker started")
logger.info(f"   Region: {AWS_REGION}")
logger.info(f"   Bucket: {AWS_S3_BUCKET}")
logger.info(f"   Queue: {SQS_QUEUE_URL}")
logger.info(f"   Results Queue: {SQS_RESULTS_QUEUE_URL}")


def download_from_s3(s3_key, local_path):
    """Download file from S3"""
    try:
        logger.info(f"📥 Downloading: {s3_key}")
        s3_client.download_file(AWS_S3_BUCKET, s3_key, local_path)
        size = os.path.getsize(local_path)
        logger.info(f"✅ Downloaded: {s3_key} ({size / (1024*1024):.2f} MB)")
        return True
    except Exception as e:
        logger.error(f"❌ Download failed: {s3_key} — {e}")
        return False


def upload_to_s3(local_path, s3_key):
    """Upload file to S3"""
    try:
        size = os.path.getsize(local_path)
        logger.info(f"📤 Uploading: {s3_key} ({size / (1024*1024):.2f} MB)")
        s3_client.upload_fileobj(
            open(local_path, 'rb'),
            AWS_S3_BUCKET,
            s3_key,
            ExtraArgs={'ContentType': 'video/mp4'}
        )
        logger.info(f"✅ Uploaded: {s3_key}")
        return True
    except Exception as e:
        logger.error(f"❌ Upload failed: {s3_key} — {e}")
        return False


def get_duration(file_path):
    """Get media file duration using ffprobe"""
    try:
        cmd = [
            'ffprobe', '-v', 'error', '-show_entries',
            'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1',
            file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return float(result.stdout.strip())
    except Exception:
        return 0


def merge_video_audio(video_path, audio_path, output_path):
    """Merge video + audio using FFmpeg"""
    try:
        video_exists = os.path.exists(video_path) and os.path.getsize(video_path) > 0
        audio_exists = os.path.exists(audio_path) and os.path.getsize(audio_path) > 0

        if not video_exists:
            logger.error("❌ Video file missing or empty")
            return False

        video_duration = get_duration(video_path)
        logger.info(f"📹 Video duration: {video_duration:.2f}s")

        if audio_exists:
            audio_duration = get_duration(audio_path)
            logger.info(f"🎵 Audio duration: {audio_duration:.2f}s")

            merge_cmd = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-i', audio_path,
                '-c:v', 'copy',       # Copy video stream (no re-encode)
                '-c:a', 'aac',        # Encode audio to AAC
                '-b:a', '192k',
                '-shortest',          # Use shortest stream
                output_path
            ]
            logger.info("🔀 Merging video + audio...")
        else:
            # No audio — add silent track
            merge_cmd = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-f', 'lavfi',
                '-i', 'anullsrc=r=48000:cl=stereo',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-shortest',
                output_path
            ]
            logger.warning("⚠️ No audio — adding silent track")

        result = subprocess.run(merge_cmd, capture_output=True, timeout=600)

        if result.returncode != 0:
            stderr = result.stderr.decode('utf-8', errors='ignore')
            logger.error(f"❌ FFmpeg merge failed: {stderr[-500:]}")
            return False

        merged_size = os.path.getsize(output_path)
        merged_duration = get_duration(output_path)
        logger.info(f"✅ Merge complete: {merged_size / (1024*1024):.2f} MB, {merged_duration:.2f}s")
        return True

    except subprocess.TimeoutExpired:
        logger.error("❌ FFmpeg merge timed out (600s)")
        return False
    except Exception as e:
        logger.error(f"❌ Merge error: {e}")
        return False


def send_result(message_body):
    """Send merge result to SQS results queue"""
    try:
        sqs_client.send_message(
            QueueUrl=SQS_RESULTS_QUEUE_URL,
            MessageBody=json.dumps(message_body)
        )
        logger.info(f"✅ Result sent to queue: {message_body.get('status')}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send result: {e}")
        return False


def process_merge_request(message):
    """Process a single merge request"""
    try:
        body = json.loads(message['Body'])

        meeting_id = body.get('meeting_id')
        session_id = body.get('session_id')
        video_s3_key = body.get('video_s3_key')
        audio_s3_key = body.get('audio_s3_key')
        user_id = body.get('user_id')
        timestamp = body.get('timestamp')
        recording_doc_id = body.get('recording_doc_id')

        logger.info(f"🎬 Processing merge request: meeting={meeting_id}, session={session_id}")
        logger.info(f"   Video: {video_s3_key}")
        logger.info(f"   Audio: {audio_s3_key}")

        if not all([meeting_id, session_id, video_s3_key, audio_s3_key]):
            logger.error("❌ Missing required fields in message")
            send_result({
                "status": "error",
                "meeting_id": meeting_id,
                "session_id": session_id,
                "error": "Missing required fields"
            })
            return False

        with TemporaryDirectory() as workdir:
            # Download video
            video_local = os.path.join(workdir, "video.mp4")
            if not download_from_s3(video_s3_key, video_local):
                send_result({
                    "status": "error",
                    "meeting_id": meeting_id,
                    "session_id": session_id,
                    "error": "Video download failed"
                })
                return False

            # Download audio
            audio_local = os.path.join(workdir, "audio.wav")
            if not download_from_s3(audio_s3_key, audio_local):
                send_result({
                    "status": "error",
                    "meeting_id": meeting_id,
                    "session_id": session_id,
                    "error": "Audio download failed"
                })
                return False

            # Merge
            merged_local = os.path.join(workdir, "merged.mp4")
            if not merge_video_audio(video_local, audio_local, merged_local):
                send_result({
                    "status": "error",
                    "meeting_id": meeting_id,
                    "session_id": session_id,
                    "error": "Merge failed"
                })
                return False

            # Upload merged file
            merged_s3_key = f"videos/{meeting_id}_{session_id}_{timestamp}.mp4"
            if not upload_to_s3(merged_local, merged_s3_key):
                send_result({
                    "status": "error",
                    "meeting_id": meeting_id,
                    "session_id": session_id,
                    "error": "Upload failed"
                })
                return False

            # Get merged file size and duration
            merged_size = os.path.getsize(merged_local)
            merged_duration = get_duration(merged_local)

            # Send success result
            send_result({
                "status": "success",
                "meeting_id": meeting_id,
                "session_id": session_id,
                "user_id": user_id,
                "recording_doc_id": recording_doc_id,
                "merged_s3_key": merged_s3_key,
                "file_size": merged_size,
                "duration": merged_duration,
                "timestamp": timestamp
            })

            logger.info(f"🎉 Merge complete for {meeting_id}: {merged_s3_key}")
            return True

    except json.JSONDecodeError:
        logger.error(f"❌ Invalid JSON in message: {message.get('Body', '')[:200]}")
        return False
    except Exception as e:
        logger.error(f"❌ Processing error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


def poll_queue():
    """Main polling loop — runs forever"""
    logger.info("🔄 Starting SQS polling loop...")

    while True:
        try:
            response = sqs_client.receive_message(
                QueueUrl=SQS_QUEUE_URL,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=20,         # Long polling
                VisibilityTimeout=900       # 15 minutes to process
            )

            messages = response.get('Messages', [])

            if not messages:
                continue

            for message in messages:
                receipt_handle = message['ReceiptHandle']

                success = process_merge_request(message)

                # Delete message from queue (whether success or fail — errors go to results queue)
                try:
                    sqs_client.delete_message(
                        QueueUrl=SQS_QUEUE_URL,
                        ReceiptHandle=receipt_handle
                    )
                    logger.info("✅ Message deleted from queue")
                except Exception as e:
                    logger.error(f"❌ Failed to delete message: {e}")

        except KeyboardInterrupt:
            logger.info("🛑 Shutting down...")
            break
        except Exception as e:
            logger.error(f"❌ Poll error: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    poll_queue()