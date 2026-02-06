# core/livekit_recording/standalone_server.py
"""
Standalone HTTP server for LiveKit recording service.
Runs independently from Django/Gunicorn to avoid max-requests limits.
"""

# ============================================
# CRITICAL: Initialize Django BEFORE any imports
# ============================================
import os
import sys

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SampleDB.settings')

# Initialize Django
import django
django.setup()

# ============================================
# Now safe to import everything else
# ============================================
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import logging
import uvicorn

# Import the existing recording service (now Django is ready)
from core.livekit_recording.recording_service import stream_recording_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("recording_service_api")

# Create FastAPI app
app = FastAPI(
    title="iMeetPro Recording Service",
    description="Standalone LiveKit recording service API",
    version="1.0.0"
)

# ============================================
# Request Models
# ============================================

class StartRecordingRequest(BaseModel):
    meeting_id: str
    host_user_id: str
    room_name: Optional[str] = None

class StopRecordingRequest(BaseModel):
    meeting_id: str

class PauseRecordingRequest(BaseModel):
    meeting_id: str

class ResumeRecordingRequest(BaseModel):
    meeting_id: str

class RecordingStatusRequest(BaseModel):
    meeting_id: str

# ============================================
# Health Check
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes probes"""
    return {
        "status": "healthy",
        "service": "recording-service",
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    """Root endpoint with service info"""
    return {
        "service": "iMeetPro Recording Service",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "start": "/start (POST)",
            "stop": "/stop (POST)",
            "pause": "/pause (POST)",
            "resume": "/resume (POST)",
            "status": "/status/{meeting_id} (GET)",
            "list": "/list (GET)"
        }
    }

# ============================================
# Recording Endpoints
# ============================================

@app.post("/start")
async def start_recording(request: StartRecordingRequest):
    """
    Start LiveKit stream recording for a meeting.
    
    This endpoint initiates a recording bot that joins the LiveKit room
    and captures all participant streams (video + audio + screen share).
    """
    try:
        logger.info(f"📹 Start recording request: meeting_id={request.meeting_id}")
        
        # Determine room name
        room_name = request.room_name or f"meeting_{request.meeting_id}"
        
        # Call the recording service
        result = stream_recording_service.start_stream_recording(
            meeting_id=request.meeting_id,
            host_user_id=request.host_user_id,
            room_name=room_name
        )
        
        if result.get("status") == "success":
            logger.info(f"✅ Recording started: {request.meeting_id}")
            return JSONResponse(content=result, status_code=200)
        elif result.get("status") in ["already_active", "already_exists"]:
            logger.info(f"⚠️ Recording already active: {request.meeting_id}")
            return JSONResponse(content=result, status_code=200)
        else:
            logger.error(f"❌ Failed to start recording: {result.get('message')}")
            return JSONResponse(content=result, status_code=500)
            
    except Exception as e:
        logger.error(f"❌ Start recording error: {e}")
        return JSONResponse(
            content={
                "status": "error",
                "message": f"Internal server error: {str(e)}",
                "meeting_id": request.meeting_id
            },
            status_code=500
        )

@app.post("/stop")
async def stop_recording(request: StopRecordingRequest):
    """
    Stop LiveKit stream recording for a meeting.
    
    This endpoint stops the recording bot and triggers post-processing
    of the captured video (transcription, summary, etc.).
    """
    try:
        logger.info(f"🛑 Stop recording request: meeting_id={request.meeting_id}")
        
        # Call the recording service
        result = stream_recording_service.stop_stream_recording(
            meeting_id=request.meeting_id
        )
        
        if result.get("status") in ["success", "partial_success"]:
            logger.info(f"✅ Recording stopped: {request.meeting_id}")
            return JSONResponse(content=result, status_code=200)
        elif result.get("status") == "no_recording":
            logger.info(f"⚠️ No active recording: {request.meeting_id}")
            return JSONResponse(content=result, status_code=404)
        else:
            logger.error(f"❌ Failed to stop recording: {result.get('message')}")
            return JSONResponse(content=result, status_code=500)
            
    except Exception as e:
        logger.error(f"❌ Stop recording error: {e}")
        return JSONResponse(
            content={
                "status": "error",
                "message": f"Internal server error: {str(e)}",
                "meeting_id": request.meeting_id
            },
            status_code=500
        )

@app.post("/pause")
async def pause_recording(request: PauseRecordingRequest):
    """
    Pause LiveKit stream recording (freezes timeline).
    """
    try:
        logger.info(f"⏸️ Pause recording request: meeting_id={request.meeting_id}")
        
        result = stream_recording_service.pause_stream_recording(
            meeting_id=request.meeting_id
        )
        
        if result.get("status") == "paused":
            logger.info(f"✅ Recording paused: {request.meeting_id}")
            return JSONResponse(content=result, status_code=200)
        else:
            return JSONResponse(content=result, status_code=400)
            
    except Exception as e:
        logger.error(f"❌ Pause recording error: {e}")
        return JSONResponse(
            content={
                "status": "error",
                "message": f"Internal server error: {str(e)}",
                "meeting_id": request.meeting_id
            },
            status_code=500
        )

@app.post("/resume")
async def resume_recording(request: ResumeRecordingRequest):
    """
    Resume paused LiveKit stream recording.
    """
    try:
        logger.info(f"▶️ Resume recording request: meeting_id={request.meeting_id}")
        
        result = stream_recording_service.resume_stream_recording(
            meeting_id=request.meeting_id
        )
        
        if result.get("status") == "resumed":
            logger.info(f"✅ Recording resumed: {request.meeting_id}")
            return JSONResponse(content=result, status_code=200)
        else:
            return JSONResponse(content=result, status_code=400)
            
    except Exception as e:
        logger.error(f"❌ Resume recording error: {e}")
        return JSONResponse(
            content={
                "status": "error",
                "message": f"Internal server error: {str(e)}",
                "meeting_id": request.meeting_id
            },
            status_code=500
        )

@app.get("/status/{meeting_id}")
async def get_status(meeting_id: str):
    """
    Get current recording status for a meeting.
    """
    try:
        logger.info(f"📊 Status request: meeting_id={meeting_id}")
        
        result = stream_recording_service.get_recording_status(meeting_id)
        
        return JSONResponse(content=result, status_code=200)
            
    except Exception as e:
        logger.error(f"❌ Get status error: {e}")
        return JSONResponse(
            content={
                "status": "error",
                "message": f"Internal server error: {str(e)}",
                "meeting_id": meeting_id
            },
            status_code=500
        )

@app.get("/list")
async def list_active():
    """
    List all active recordings across all meetings.
    """
    try:
        logger.info(f"📋 List active recordings request")
        
        active_recordings = stream_recording_service.list_active_recordings()
        
        return JSONResponse(
            content={
                "status": "success",
                "active_recordings": active_recordings,
                "total_count": len(active_recordings)
            },
            status_code=200
        )
            
    except Exception as e:
        logger.error(f"❌ List active error: {e}")
        return JSONResponse(
            content={
                "status": "error",
                "message": f"Internal server error: {str(e)}"
            },
            status_code=500
        )

# ============================================
# Exception Handlers
# ============================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"❌ Unhandled exception: {exc}")
    return JSONResponse(
        content={
            "status": "error",
            "message": "Internal server error",
            "detail": str(exc)
        },
        status_code=500
    )

# ============================================
# Main Entry Point
# ============================================

if __name__ == "__main__":
    # Get configuration from environment
    host = os.getenv("RECORDING_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("RECORDING_SERVICE_PORT", 8080))
    workers = int(os.getenv("RECORDING_SERVICE_WORKERS", 1))
    
    logger.info(f"🚀 Starting Recording Service API on {host}:{port}")
    logger.info(f"👷 Workers: {workers}")
    
    # Run with uvicorn
    uvicorn.run(
        "standalone_server:app",
        host=host,
        port=port,
        workers=workers,
        log_level="info",
        access_log=True,
        loop="asyncio"
    )