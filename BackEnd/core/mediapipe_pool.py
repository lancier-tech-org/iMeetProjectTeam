"""
MediaPipe Instance Pool - Thread-Local Reuse
==============================================
Replaces per-request MediaPipe creation with thread-local pooling.

Old: 4 new MediaPipe instances per frame (~150ms overhead)
New: Reused instances per thread (0ms overhead after first call)

Location: core/mediapipe_pool.py

Usage in attendance.py:
    # OLD:
    # face_results, mesh_results, pose_results, hand_results = get_mediapipe_results_per_request(rgb)

    # NEW (same signature, same return values):
    from core.mediapipe_pool import get_mediapipe_results
    face_results, mesh_results, pose_results, hand_results = get_mediapipe_results(rgb)
"""

import threading
import logging
import mediapipe as mp

logger = logging.getLogger("mediapipe_pool")

# =============================================================================
# THREAD-LOCAL STORAGE - Each thread gets its own MediaPipe instances
# =============================================================================

_thread_local = threading.local()


def _get_instances():
    """
    Get or create MediaPipe instances for the current thread.
    Instances are reused across all frames processed by this thread.

    Returns:
        tuple: (face_detection, face_mesh, pose, hands)
    """
    if not hasattr(_thread_local, "initialized") or not _thread_local.initialized:
        logger.info(
            f"🔧 Creating MediaPipe instances for thread {threading.current_thread().name}"
        )

        _thread_local.face_detection = mp.solutions.face_detection.FaceDetection(
            model_selection=1, min_detection_confidence=0.5
        )
        _thread_local.face_mesh = mp.solutions.face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        _thread_local.pose = mp.solutions.pose.Pose(
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        _thread_local.hands = mp.solutions.hands.Hands(
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        _thread_local.initialized = True

        logger.info(
            f"✅ MediaPipe instances ready for thread {threading.current_thread().name}"
        )

    return (
        _thread_local.face_detection,
        _thread_local.face_mesh,
        _thread_local.pose,
        _thread_local.hands,
    )


# =============================================================================
# PUBLIC API - Drop-in replacement for get_mediapipe_results_per_request()
# =============================================================================


def get_mediapipe_results(rgb_frame):
    """
    Process an RGB frame through all 4 MediaPipe models.

    This is a DROP-IN REPLACEMENT for get_mediapipe_results_per_request().
    Same input, same output. The only difference is that it reuses
    MediaPipe instances instead of creating new ones each time.

    Args:
        rgb_frame: numpy array, RGB format image

    Returns:
        tuple: (face_results, mesh_results, pose_results, hand_results)
            Same format as the old function.
    """
    try:
        face_detection, face_mesh, pose, hands = _get_instances()

        # Make frame read-only for MediaPipe (same as original)
        rgb_frame.flags.writeable = False

        face_results = face_detection.process(rgb_frame)
        mesh_results = face_mesh.process(rgb_frame)
        pose_results = pose.process(rgb_frame)
        hand_results = hands.process(rgb_frame)

        # Restore writeable flag
        rgb_frame.flags.writeable = True

        return face_results, mesh_results, pose_results, hand_results

    except Exception as e:
        logger.error(f"❌ MediaPipe processing error: {e}")

        # Reset instances on error so they're recreated next time
        _thread_local.initialized = False

        # Re-raise so the caller handles it the same way as before
        raise


def reset_pool():
    """
    Force reset of MediaPipe instances for the current thread.
    Useful if you suspect corrupt state.
    """
    _thread_local.initialized = False
    logger.info(
        f"🔄 MediaPipe pool reset for thread {threading.current_thread().name}"
    )