"""
HTTP client for Recording Service.
Replaces direct import of stream_recording_service.
"""
import os
import logging
import requests

logger = logging.getLogger(__name__)

RECORDING_SERVICE_URL = os.getenv("RECORDING_SERVICE_URL", "http://localhost:8236")


class StreamRecordingServiceClient:
    def stop_stream_recording(self, meeting_id):
        """Stop stream recording via Recording Service API"""
        try:
            response = requests.post(
                f"{RECORDING_SERVICE_URL}/api/stream-recording/stop/{meeting_id}",
                json={},
                timeout=15
            )
            if response.status_code == 200:
                return response.json()
            logger.warning(f"Recording stop returned {response.status_code}")
            return {"status": "error", "message": f"HTTP {response.status_code}"}
        except requests.exceptions.ConnectionError:
            logger.error("Cannot connect to Recording Service")
            return {"status": "error", "message": "Recording service unavailable"}
        except Exception as e:
            logger.error(f"Recording client error: {e}")
            return {"status": "error", "message": str(e)}

stream_recording_service = StreamRecordingServiceClient()