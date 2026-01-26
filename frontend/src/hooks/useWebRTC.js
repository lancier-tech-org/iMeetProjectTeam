// src/hooks/useWebRTC.js - UPDATED VERSION - Compatible with Single Recording Dialog
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveKit } from './useLiveKit';
import { API_BASE_URL } from '../utils/constants';
import {  
  createLocalVideoTrack,  
  createLocalAudioTrack,
  Track
} from 'livekit-client';

const useWebRTC = (meetingId, userId, isHost = false) => {
  // State management
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [screenSharer, setScreenSharer] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [errors, setErrors] = useState([]);
  const [meetingStatus, setMeetingStatus] = useState('active');
  const [inWaitingRoom, setInWaitingRoom] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [realMeetingId, setRealMeetingId] = useState(null);
  const [initialParticipantsLoaded, setInitialParticipantsLoaded] = useState(false);
  const [participantId, setParticipantId] = useState(null);

  // Refs
  const localVideoRef = useRef(null);
  const participantsMapRef = useRef(new Map());
  const isCleaningUpRef = useRef(false);
  const currentUserRef = useRef(null);

  // LiveKit context with comprehensive null checks
  const {
    room,
    connected,
    connecting,
    connectionError,
    localParticipant,
    remoteParticipants,
    connectToRoom: livekitConnect,
    disconnectFromRoom: livekitDisconnect,
    sendChatMessage: livekitSendChat,
    sendReaction: livekitSendReaction,
    toggleAudio: livekitToggleAudio,
    toggleVideo: livekitToggleVideo,
    startScreenShare: livekitStartScreenShare,
    stopScreenShare: livekitStopScreenShare,
    addEventListener,
    removeEventListener,
    participantCount,
    isAudioEnabled: livekitAudioEnabled,
    isVideoEnabled: livekitVideoEnabled,
    isScreenSharing: livekitScreenSharing,
    localTracks: livekitLocalTracks,
    error: livekitError
  } = useLiveKit();

  // Sync LiveKit state with local state
  useEffect(() => {
    console.log('🔄 Syncing connection state:', { connected, connecting });
    setIsConnected(connected || false);
    setConnectionState(connected ? 'connected' : connecting ? 'connecting' : 'disconnected');
  }, [connected, connecting]);

  useEffect(() => {
    if (connectionError) {
      console.error('🚨 LiveKit connection error:', connectionError);
      setErrors(prev => [...prev, {
        message: connectionError,
        type: 'connection_error',
        timestamp: Date.now()
      }]);
    }
  }, [connectionError]);

  useEffect(() => {
    if (livekitError) {
      console.error('🚨 LiveKit error:', livekitError);
      setErrors(prev => [...prev, {
        message: livekitError,
        type: 'livekit_error',
        timestamp: Date.now()
      }]);
    }
  }, [livekitError]);

  // Handle local participant changes
  useEffect(() => {
    if (localParticipant && localParticipant.getTrackPublication) {
      try {
        console.log('👤 Processing local participant:', localParticipant.identity);
        
        const videoPublication = localParticipant.getTrackPublication(Track.Source.Camera);
        const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        const screenSharePublication = localParticipant.getTrackPublication(Track.Source.ScreenShare);
        
        // Create local stream from tracks
        if (videoPublication?.track?.mediaStreamTrack || audioPublication?.track?.mediaStreamTrack) {
          const stream = new MediaStream();
          
          if (videoPublication?.track?.mediaStreamTrack) {
            stream.addTrack(videoPublication.track.mediaStreamTrack);
            console.log('✅ Added local video track to stream');
          }
          
          if (audioPublication?.track?.mediaStreamTrack) {
            stream.addTrack(audioPublication.track.mediaStreamTrack);
            console.log('✅ Added local audio track to stream');
          }
          
          setLocalStream(stream);
          
          // Set video element source
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }

        // Check if local participant is screen sharing
        const isLocalScreenSharing = !!screenSharePublication?.track;
        
        // Handle local screen share
        if (screenSharePublication?.track?.mediaStreamTrack) {
          const screenStream = new MediaStream([screenSharePublication.track.mediaStreamTrack]);
          setScreenShareStream(screenStream);
          setScreenSharer({
            connection_id: localParticipant.sid || localParticipant.identity,
            user_id: userId,
            name: localParticipant.name || currentUserRef.current?.full_name || 'You',
            participant_id: localParticipant.sid || localParticipant.identity
          });
          setIsScreenSharing(true);
          console.log('🖥️ Local screen share detected and set');
        }

        // Update participant info
        const localParticipantData = {
          id: localParticipant.sid || localParticipant.identity || 'local',
          participant_id: localParticipant.sid || localParticipant.identity || 'local',
          user_id: userId,
          connection_id: localParticipant.sid || localParticipant.identity || 'local',
          full_name: localParticipant.name || localParticipant.identity || currentUserRef.current?.full_name || 'You',
          name: localParticipant.name || localParticipant.identity || currentUserRef.current?.name || 'You',
          displayName: localParticipant.name || localParticipant.identity || currentUserRef.current?.full_name || 'You',
          isLocal: true,
          isVideoEnabled: localParticipant.isCameraEnabled || false,
          isAudioEnabled: localParticipant.isMicrophoneEnabled || false,
          video_enabled: localParticipant.isCameraEnabled || false,
          audio_enabled: localParticipant.isMicrophoneEnabled || false,
          role: isHost ? 'host' : 'participant',
          stream: localStream,
          isScreenSharing: isLocalScreenSharing,
          join_time: new Date().toISOString(),
          connectionQuality: 'good',
          Status: 'live',
          LiveKit_Connected: true
        };

        setParticipants(prev => {
          const filtered = prev.filter(p => !p.isLocal);
          return [localParticipantData, ...filtered];
        });

        // Sync media states
        setIsVideoEnabled(localParticipant.isCameraEnabled || false);
        setIsAudioEnabled(localParticipant.isMicrophoneEnabled || false);
        
      } catch (error) {
        console.error('❌ Error processing local participant:', error);
        setErrors(prev => [...prev, {
          message: `Failed to process local participant: ${error.message}`,
          type: 'participant_error',
          timestamp: Date.now()
        }]);
      }
    }
  }, [localParticipant, localStream, userId, isHost]);

  // Handle remote participants
  useEffect(() => {
    try {
      if (!remoteParticipants) {
        console.log('ℹ️ No remote participants available');
        return;
      }

      console.log('🌐 Processing remote participants:', remoteParticipants.size || remoteParticipants.length || 'unknown count');

      // Handle different types of remoteParticipants
      let remoteParticipantsArray = [];
      
      if (remoteParticipants instanceof Map) {
        remoteParticipantsArray = Array.from(remoteParticipants.values());
      } else if (Array.isArray(remoteParticipants)) {
        remoteParticipantsArray = remoteParticipants;
      } else if (remoteParticipants.values && typeof remoteParticipants.values === 'function') {
        remoteParticipantsArray = Array.from(remoteParticipants.values());
      } else {
        console.warn('⚠️ remoteParticipants is not in expected format:', typeof remoteParticipants);
        return;
      }
      
      const remoteStreamsMap = new Map();
      let hasScreenShare = false;
      let screenShareParticipant = null;
      let screenStream = null;
      
      remoteParticipantsArray.forEach(participant => {
        if (!participant || !participant.getTrackPublication) {
          console.warn('⚠️ Invalid participant:', participant);
          return;
        }
        
        try {
          console.log(`🔍 Processing remote participant: ${participant.identity}`);
          
          const videoPublication = participant.getTrackPublication(Track.Source.Camera);
          const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
          const screenPublication = participant.getTrackPublication(Track.Source.ScreenShare);
          
          // Handle regular video/audio tracks
          if (videoPublication?.track?.mediaStreamTrack || audioPublication?.track?.mediaStreamTrack) {
            const stream = new MediaStream();
            
            if (videoPublication?.track?.mediaStreamTrack) {
              stream.addTrack(videoPublication.track.mediaStreamTrack);
              console.log(`📹 Added remote video track for ${participant.identity}`);
            }
            
            if (audioPublication?.track?.mediaStreamTrack) {
              stream.addTrack(audioPublication.track.mediaStreamTrack);
              console.log(`🎤 Added remote audio track for ${participant.identity}`);
            }
            
            const participantId = participant.sid || participant.identity || Date.now().toString();
            
            const streamKeys = [
              participantId,
              participant.identity,
              participant.sid
            ].filter(Boolean);
            
            streamKeys.forEach(key => {
              remoteStreamsMap.set(key, stream);
            });
            
            if (participant.identity?.includes('user_')) {
              const parts = participant.identity.split('_');
              if (parts.length >= 2) {
                const userId = parts[1];
                remoteStreamsMap.set(userId, stream);
                remoteStreamsMap.set(`user_${userId}`, stream);
              }
            }
          }

          // Handle screen share
          if (screenPublication?.track?.mediaStreamTrack) {
            screenStream = new MediaStream([screenPublication.track.mediaStreamTrack]);
            
            let extractedUserId = participant.identity || 'unknown';
            if (participant.identity?.includes('user_')) {
              const parts = participant.identity.split('_');
              if (parts.length >= 2) {
                extractedUserId = parts[1];
              }
            }
            
            screenShareParticipant = {
              connection_id: participant.sid || participant.identity,
              user_id: extractedUserId,
              name: participant.name || participant.identity || 'Unknown',
              participant_id: participant.sid || participant.identity,
              identity: participant.identity
            };
            
            hasScreenShare = true;
            
            console.log('🖥️ Screen share detected from:', screenShareParticipant.name, screenShareParticipant);
            
            remoteStreamsMap.set(`${extractedUserId}_screen`, screenStream);
            remoteStreamsMap.set(`${participant.sid}_screen`, screenStream);
          }
          
        } catch (participantError) {
          console.error('❌ Error processing remote participant:', participantError);
          setErrors(prev => [...prev, {
            message: `Failed to process participant ${participant.identity}: ${participantError.message}`,
            type: 'participant_error',
            timestamp: Date.now()
          }]);
        }
      });

      // Update screen sharing state
      if (hasScreenShare) {
        setScreenShareStream(screenStream);
        setScreenSharer(screenShareParticipant);
        setIsScreenSharing(true);
      } else if (!localParticipant?.getTrackPublication(Track.Source.ScreenShare)) {
        setScreenShareStream(null);
        setScreenSharer(null);
        setIsScreenSharing(false);
      }

      setRemoteStreams(remoteStreamsMap);

      // Update participants list
      const remoteParticipantData = remoteParticipantsArray.map(participant => {
        if (!participant) return null;
        
        const participantId = participant.sid || participant.identity || Date.now().toString();
        let userId = participant.identity || 'unknown';
        
        if (participant.identity?.includes('user_')) {
          const parts = participant.identity.split('_');
          if (parts.length >= 2) {
            userId = parts[1];
          }
        }
        
        const isParticipantScreenSharing = !!participant.getTrackPublication(Track.Source.ScreenShare)?.track;
        
        return {
          id: participantId,
          participant_id: participantId,
          user_id: userId,
          connection_id: participantId,
          full_name: participant.name || participant.identity || `User ${userId}`,
          name: participant.name || participant.identity || `User ${userId}`,
          displayName: participant.name || participant.identity || `User ${userId}`,
          isLocal: false,
          isVideoEnabled: participant.isCameraEnabled || false,
          isAudioEnabled: participant.isMicrophoneEnabled || false,
          video_enabled: participant.isCameraEnabled || false,
          audio_enabled: participant.isMicrophoneEnabled || false,
          role: 'participant',
          stream: remoteStreamsMap.get(participantId) || remoteStreamsMap.get(userId),
          isScreenSharing: isParticipantScreenSharing,
          join_time: new Date().toISOString(),
          connectionQuality: 'good',
          Status: 'live',
          LiveKit_Connected: true
        };
      }).filter(Boolean);

      setParticipants(prev => {
        const localParticipant = prev.find(p => p.isLocal);
        return localParticipant ? [localParticipant, ...remoteParticipantData] : remoteParticipantData;
      });

      console.log(`✅ Processed ${remoteParticipantData.length} remote participants, ${remoteStreamsMap.size} streams`);

    } catch (error) {
      console.error('❌ Error processing remote participants:', error);
      setErrors(prev => [...prev, {
        message: `Failed to process participants: ${error.message}`,
        type: 'participant_error',
        timestamp: Date.now()
      }]);
    }
  }, [remoteParticipants, localParticipant, userId]);

  // Setup event listeners
  useEffect(() => {
    if (!connected || !addEventListener || !removeEventListener) {
      return;
    }

    console.log('✅ Setting up enhanced event listeners');

    const handleUserJoined = (data) => {
      console.log('👤 User joined via LiveKit:', data);
      setTimeout(() => {
        // Trigger participant list refresh
      }, 500);
    };

    const handleUserLeft = (data) => {
      console.log('👋 User left via LiveKit:', data);
      if (data?.user_id) {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.user_id);
          newMap.delete(`user_${data.user_id}`);
          newMap.delete(data.connection_id);
          return newMap;
        });
      }
    };

    const handleChatMessage = (data) => {
      console.log('💬 Chat message received:', data);
    };

    const handleReaction = (data) => {
      console.log('😀 Reaction received:', data);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reaction-received', {
          detail: {
            emoji: data.emoji,
            userName: data.user_name,
            participantId: data.user_id,
            timestamp: data.timestamp
          }
        }));
      }
    };

    const handleScreenShareStarted = (data) => {
      console.log('🖥️ Screen share started:', data);
      if (data.user_id !== userId) {
        setScreenSharer({
          connection_id: data.connection_id,
          user_id: data.user_id,
          name: data.user_name,
          participant_id: data.participant_id
        });
        setIsScreenSharing(true);
      }
    };

    const handleScreenShareStopped = (data) => {
      console.log('🖥️ Screen share stopped:', data);
      if (data.user_id !== userId) {
        setScreenSharer(null);
        setScreenShareStream(null);
        setIsScreenSharing(false);
      }
    };

    const handleConnectionQualityChanged = (quality) => {
      console.log('📶 Connection quality changed:', quality);
      setConnectionQuality(quality);
    };

    try {
      addEventListener('user_joined', handleUserJoined);
      addEventListener('user_left', handleUserLeft);
      addEventListener('participant_joined', handleUserJoined);
      addEventListener('participant_left', handleUserLeft);
      addEventListener('chat-message', handleChatMessage);
      addEventListener('reaction_received', handleReaction);
      addEventListener('screen_share_started', handleScreenShareStarted);
      addEventListener('screen_share_stopped', handleScreenShareStopped);
      addEventListener('connection_quality_changed', handleConnectionQualityChanged);
      
      console.log('✅ Event listeners set up successfully');
    } catch (error) {
      console.error('❌ Error setting up event listeners:', error);
      setErrors(prev => [...prev, {
        message: `Failed to setup event listeners: ${error.message}`,
        type: 'event_listener_error',
        timestamp: Date.now()
      }]);
    }

    return () => {
      try {
        removeEventListener('user_joined', handleUserJoined);
        removeEventListener('user_left', handleUserLeft);
        removeEventListener('participant_joined', handleUserJoined);
        removeEventListener('participant_left', handleUserLeft);
        removeEventListener('chat-message', handleChatMessage);
        removeEventListener('reaction_received', handleReaction);
        removeEventListener('screen_share_started', handleScreenShareStarted);
        removeEventListener('screen_share_stopped', handleScreenShareStopped);
        removeEventListener('connection_quality_changed', handleConnectionQualityChanged);
        
        console.log('✅ Event listeners cleaned up successfully');
      } catch (error) {
        console.error('❌ Error removing event listeners:', error);
      }
    };
  }, [connected, addEventListener, removeEventListener, userId]);

  // Database participant registration
  const registerParticipantInDatabase = useCallback(async (participantName) => {
    try {
      console.log('📝 Registering participant in database:', participantName);
      
      const response = await fetch(`${API_BASE_URL}/api/participants/record-join/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Meeting_ID: meetingId,
          User_ID: userId,
          Full_Name: participantName,
          Role: isHost ? 'host' : 'participant',
          Engagement_Score: 0.0,
          Attendance_Percentage: 100.0
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Participant registered:', data.Participant_ID);
        setParticipantId(data.Participant_ID);
        return { success: true, participantId: data.Participant_ID };
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to register participant:', errorData.Error);
        return { success: false, error: errorData.Error };
      }
    } catch (error) {
      console.error('❌ Error registering participant:', error);
      return { success: false, error: error.message };
    }
  }, [meetingId, userId, isHost]);

  const unregisterParticipantFromDatabase = useCallback(async () => {
    if (!participantId) return;

    try {
      console.log('📝 Unregistering participant:', participantId);
      
      const response = await fetch(`${API_BASE_URL}/api/participants/leave/${participantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        console.log('✅ Participant unregistered successfully');
        setParticipantId(null);
      }
    } catch (error) {
      console.error('❌ Error unregistering participant:', error);
    }
  }, [participantId]);

  const syncParticipantsFromDatabase = useCallback(async () => {
    // ✅ ADD: Skip if no real meeting ID
    if (!meetingId || meetingId === 'instant') {
      console.log('⏭️ Skipping participant sync - no real meeting ID yet');
      return [];
    }

    try {
      console.log('🔄 Syncing participants from database...');

      // ✅ FIX: Added parentheses around fetch argument
      const response = await fetch(`${API_BASE_URL}/api/participants/list/${meetingId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const participantsData = await response.json();
        console.log('✅ Participants synced from database:', participantsData.length);
        return participantsData;
      }
    } catch (error) {
      console.error('❌ Error syncing participants:', error);
    }
    return [];
  }, [meetingId]);

  // Join meeting function
  const joinMeeting = useCallback(async (participantName) => {
    console.log('🚀 useWebRTC joinMeeting called:', { participantName, meetingId, userId, isHost });
    
    try {
      currentUserRef.current = {
        id: userId,
        full_name: participantName,
        name: participantName,
        isHost
      };

      setRealMeetingId(meetingId);
      
      // Register in database and sync participants
      await registerParticipantInDatabase(participantName);
      await syncParticipantsFromDatabase();
      
      setInitialParticipantsLoaded(true);
      
      console.log('✅ useWebRTC: Database registration completed successfully');
      return true;
    } catch (error) {
      console.error('❌ useWebRTC: Failed to complete registration:', error);
      setErrors(prev => [...prev, {
        message: error.message,
        type: 'join_error',
        timestamp: Date.now()
      }]);
      throw error;
    }
  }, [meetingId, userId, isHost, registerParticipantInDatabase, syncParticipantsFromDatabase]);

  // Leave meeting function
  const leaveMeeting = useCallback(async () => {
    console.log('👋 useWebRTC: Leaving meeting cleanup');
    
    try {
      isCleaningUpRef.current = true;
      
      // Unregister from database
      await unregisterParticipantFromDatabase();
      
      // Reset state
      setLocalStream(null);
      setRemoteStreams(new Map());
      setParticipants([]);
      setIsConnected(false);
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
      setIsScreenSharing(false);
      setScreenShareStream(null);
      setScreenSharer(null);
      setErrors([]);
      setRealMeetingId(null);
      setInitialParticipantsLoaded(false);
      setParticipantId(null);
      setConnectionQuality('good');
      setMeetingStatus('active');
      setInWaitingRoom(false);
      setConnectionState('disconnected');
      
      console.log('✅ useWebRTC: Cleanup completed successfully');
    } catch (error) {
      console.error('❌ useWebRTC: Error during cleanup:', error);
    } finally {
      isCleaningUpRef.current = false;
    }
  }, [unregisterParticipantFromDatabase]);

  // Media control functions
  const toggleVideo = useCallback(async () => {
    try {
      console.log('📹 useWebRTC toggleVideo called, current state:', isVideoEnabled);
      
      if (livekitToggleVideo) {
        const newState = await livekitToggleVideo();
        console.log('📹 LiveKit toggle video returned:', newState);
        setIsVideoEnabled(newState);
        return newState;
      } else {
        console.warn('⚠️ LiveKit toggle video not available, using local state');
        const newState = !isVideoEnabled;
        setIsVideoEnabled(newState);
        return newState;
      }
    } catch (error) {
      console.error('❌ Error toggling video:', error);
      setErrors(prev => [...prev, {
        message: `Video toggle failed: ${error.message}`,
        type: 'media_error',
        timestamp: Date.now()
      }]);
      return isVideoEnabled;
    }
  }, [livekitToggleVideo, isVideoEnabled]);

  const toggleAudio = useCallback(async () => {
    try {
      console.log('🎤 useWebRTC toggleAudio called, current state:', isAudioEnabled);
      
      if (livekitToggleAudio) {
        const newState = await livekitToggleAudio();
        console.log('🎤 LiveKit toggle audio returned:', newState);
        setIsAudioEnabled(newState);
        return newState;
      } else {
        console.warn('⚠️ LiveKit toggle audio not available, using local state');
        const newState = !isAudioEnabled;
        setIsAudioEnabled(newState);
        return newState;
      }
    } catch (error) {
      console.error('❌ Error toggling audio:', error);
      setErrors(prev => [...prev, {
        message: `Audio toggle failed: ${error.message}`,
        type: 'media_error',
        timestamp: Date.now()
      }]);
      return isAudioEnabled;
    }
  }, [livekitToggleAudio, isAudioEnabled]);

  const startScreenShare = useCallback(async () => {
    try {
      console.log('🖥️ useWebRTC startScreenShare called');
      
      if (livekitStartScreenShare) {
        const success = await livekitStartScreenShare();
        console.log('🖥️ LiveKit start screen share returned:', success);
        if (success) {
          setIsScreenSharing(true);
        }
        return success;
      } else {
        console.warn('⚠️ LiveKit start screen share not available');
        throw new Error('Screen share function not available');
      }
    } catch (error) {
      console.error('❌ Error starting screen share:', error);
      setErrors(prev => [...prev, {
        message: `Screen share failed: ${error.message}`,
        type: 'screen_share_error',
        timestamp: Date.now()
      }]);
      throw error;
    }
  }, [livekitStartScreenShare]);

  const stopScreenShare = useCallback(async () => {
    try {
      console.log('🖥️ useWebRTC stopScreenShare called');
      
      if (livekitStopScreenShare) {
        const success = await livekitStopScreenShare();
        console.log('🖥️ LiveKit stop screen share returned:', success);
        if (success) {
          setIsScreenSharing(false);
          setScreenShareStream(null);
          setScreenSharer(null);
        }
        return success;
      } else {
        console.warn('⚠️ LiveKit stop screen share not available');
        setIsScreenSharing(false);
        setScreenShareStream(null);
        setScreenSharer(null);
        return true;
      }
    } catch (error) {
      console.error('❌ Error stopping screen share:', error);
      setIsScreenSharing(false);
      setScreenShareStream(null);
      setScreenSharer(null);
      return false;
    }
  }, [livekitStopScreenShare]);

  // Recording functions - UPDATED for single dialog compatibility
  const startRecording = useCallback(async () => {
    try {
      console.log('🔴 Starting recording...');
      const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/start-recording`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        setIsRecording(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      setErrors(prev => [...prev, {
        message: `Recording start failed: ${error.message}`,
        type: 'recording_error',
        timestamp: Date.now()
      }]);
      return false;
    }
  }, [meetingId]);

  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Stopping recording...');
      const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/stop-recording`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        setIsRecording(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      setErrors(prev => [...prev, {
        message: `Recording stop failed: ${error.message}`,
        type: 'recording_error',
        timestamp: Date.now()
      }]);
      return false;
    }
  }, [meetingId]);

  // Send message functions
  const sendDataChannelMessage = useCallback((message) => {
    try {
      console.log('📤 useWebRTC sendDataChannelMessage called:', message);
      
      if (message.type === 'reaction') {
        if (livekitSendReaction) {
          const success = livekitSendReaction(message.emoji);
          console.log('📤 LiveKit send reaction returned:', success);
          return success;
        } else {
          console.warn('⚠️ LiveKit send reaction not available');
          return false;
        }
      } else if (message.type === 'chat' || message.message) {
        if (livekitSendChat) {
          const success = livekitSendChat(message.message || message.text);
          console.log('📤 LiveKit send chat returned:', success);
          return success;
        } else {
          console.warn('⚠️ LiveKit send chat not available');
          return false;
        }
      }
      
      console.warn('⚠️ Unknown message type:', message.type);
      return false;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setErrors(prev => [...prev, {
        message: `Message send failed: ${error.message}`,
        type: 'message_error',
        timestamp: Date.now()
      }]);
      return false;
    }
  }, [livekitSendChat, livekitSendReaction]);

  const sendMessage = useCallback((type, data) => {
    return sendDataChannelMessage({ type, ...data });
  }, [sendDataChannelMessage]);

  const sendChatMessage = useCallback((text) => {
    console.log('💬 useWebRTC sendChatMessage called:', text);
    return livekitSendChat ? livekitSendChat(text) : false;
  }, [livekitSendChat]);

  // Utility functions
  const isWebSocketConnected = useCallback(() => {
    return connected || false;
  }, [connected]);

  const cleanup = useCallback(() => {
    console.log('🧹 useWebRTC: Cleaning up resources...');
    leaveMeeting();
  }, [leaveMeeting]);

  const getRealMeetingId = useCallback(() => {
    return realMeetingId || meetingId;
  }, [realMeetingId, meetingId]);

  // Sync with LiveKit media states
  useEffect(() => {
    if (livekitAudioEnabled !== undefined) {
      console.log('🔄 Syncing audio state from LiveKit:', livekitAudioEnabled);
      setIsAudioEnabled(livekitAudioEnabled);
    }
  }, [livekitAudioEnabled]);

  useEffect(() => {
    if (livekitVideoEnabled !== undefined) {
      console.log('🔄 Syncing video state from LiveKit:', livekitVideoEnabled);
      setIsVideoEnabled(livekitVideoEnabled);
    }
  }, [livekitVideoEnabled]);

  useEffect(() => {
    if (livekitScreenSharing !== undefined) {
      console.log('🔄 Syncing screen share state from LiveKit:', livekitScreenSharing);
      setIsScreenSharing(livekitScreenSharing);
    }
  }, [livekitScreenSharing]);

  // Clear old errors
  useEffect(() => {
    if (errors.length > 0) {
      const timer = setTimeout(() => {
        setErrors(prev => prev.filter(error => 
          Date.now() - error.timestamp < 30000 // Keep errors for 30 seconds
        ));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errors]);

  // Debug logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 useWebRTC state update:', {
        isConnected,
        connectionState,
        participantsCount: participants.length,
        hasLocalStream: !!localStream,
        remoteStreamsCount: remoteStreams.size,
        isVideoEnabled,
        isAudioEnabled,
        isScreenSharing,
        hasScreenShareStream: !!screenShareStream,
        livekitConnected: connected,
        livekitConnecting: connecting,
        errorsCount: errors.length
      });
    }
  }, [
    isConnected, connectionState, participants.length, localStream, remoteStreams.size, 
    isVideoEnabled, isAudioEnabled, isScreenSharing, screenShareStream, connected, 
    connecting, errors.length
  ]);

  // Connection quality monitoring
  useEffect(() => {
    if (connected && room?.localParticipant) {
      const updateQuality = () => {
        const quality = room.localParticipant.connectionQuality;
        const qualityMap = {
          0: 'poor',
          1: 'poor', 
          2: 'good',
          3: 'excellent'
        };
        setConnectionQuality(qualityMap[quality] || 'good');
      };

      updateQuality();
      const interval = setInterval(updateQuality, 5000);
      
      return () => clearInterval(interval);
    }
  }, [connected, room]);

  // Return comprehensive interface
  return {
    // State
    localStream,
    remoteStreams,
    participants,
    isConnected,
    connectionState,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    screenShareStream,
    screenSharer,
    isRecording,
    connectionQuality,
    errors,
    meetingStatus,
    inWaitingRoom,
    realMeetingId,
    initialParticipantsLoaded,
    participantId,
    
    // Refs
    localVideoRef,
    
    // Main functions
    joinMeeting,
    leaveMeeting,
    
    // Media controls
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    
    // Recording - UPDATED for compatibility
    startRecording,
    stopRecording,
    
    // Communication
    sendDataChannelMessage,
    sendMessage,
    sendChatMessage,
    
    // Utility functions
    cleanup,
    isWebSocketConnected,
    getRealMeetingId,
    
    // Database functions
    registerParticipantInDatabase,
    unregisterParticipantFromDatabase,
    syncParticipantsFromDatabase,
    
    // LiveKit integration
    room,
    localParticipant,
    remoteParticipants,
    
    // Legacy compatibility
    connected: isConnected,
    connecting: connecting,
    connectionError: connectionError || livekitError,
    connectToMeeting: joinMeeting,
    disconnect: leaveMeeting,
    addEventListener: () => {},
    removeEventListener: () => {},
    participantCount: participants.length
  };
};
export default useWebRTC;
