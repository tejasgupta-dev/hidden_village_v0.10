import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useMachine } from "@xstate/react";
import LevelPlayMachine from "./LevelPlayModule/LevelPlayMachine";
import { getUserNameFromDatabase } from '../firebase/userDatabase';
import { getGameNameByUUID, getLevelNameByUUID, getGameNameByLevelUUID, getCurricularDataByUUID, getCurrentOrgContext } from '../firebase/database';
import { getUserSettings } from '../firebase/userSettings';
import { storage, app } from '../firebase/init';
import { ref, uploadBytesResumable, getDownloadURL, getStorage } from 'firebase/storage';

const VideoRecorder = forwardRef(({ phase, curricularID, gameID }, ref) => {
  const [currentPhase, setCurrentPhase] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioStreamRef = useRef(null); // Separate audio stream for proper cleanup
  const recordingPhaseRef = useRef(null);
  const recordedVideosRef = useRef([]); // Storage for all recorded videos
  const isMountedRef = useRef(true);
  const phaseChangeIntervalRef = useRef(null); // To store interval from handlePhaseChange
  const [state, send] = useMachine(LevelPlayMachine);

  // Initialize isMountedRef when component mounts
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Checking to ensure props were received
  useEffect(() => {
    console.log("VideoRecorder props received:", { phase, curricularID, gameID });
  }, [phase, curricularID, gameID]);

  // Get the camera stream from the existing video element (defined in index.html)
  useEffect(() => {
    const inputVideo = document.getElementsByClassName("input-video")[0];
    if (!inputVideo) {
      console.error("Input video element not found");
      return;
    }
    // Poll until the input video has a stream (assigned by MediaPipe)
    const checkStream = setInterval(() => {
      if (inputVideo.srcObject) {
        clearInterval(checkStream);
        // Clone the stream so our recording is independent of MediaPipe processing
        streamRef.current = inputVideo.srcObject.clone();
        // If a phase is already set, start recording immediately
        if (phase) {
          startRecording(phase);
          setCurrentPhase(phase);
        }
      }
    }, 500);

    return () => {
      clearInterval(checkStream);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
    };
  }, []);

  // When the phase prop changes, handle recording changes with proper sequencing
  useEffect(() => {
    if (phase !== currentPhase) {
      console.log(`[VideoRecorder] Phase changing from ${currentPhase} to ${phase}`);
      
      const handlePhaseChange = async () => {
        // Step 1: Stop the current recording if one is active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log(`[VideoRecorder] Stopping recording for phase: ${recordingPhaseRef.current}`);
          mediaRecorderRef.current.stop();
          
          // Wait for the recording to fully stop before starting a new one
          // This ensures the onstop handler completes before a new recording starts
          await new Promise(resolve => {
            const checkRecording = setInterval(() => {
              if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                clearInterval(checkRecording);
                if (phaseChangeIntervalRef.current === checkRecording) {
                  phaseChangeIntervalRef.current = null;
                }
                resolve();
              }
            }, 100);
            phaseChangeIntervalRef.current = checkRecording;
          });
        }
        
        // Step 2: Start a new recording if we have a new phase
        if (phase) {
          console.log(`[VideoRecorder] Starting new recording for phase: ${phase}`);
          // Wait for stream readiness before starting recording
          const streamReady = await waitForStream();
          if (streamReady && isMountedRef.current) {
            startRecording(phase); // Pass the current phase
          } else {
            console.warn(`[VideoRecorder] Cannot start recording for phase ${phase}: video stream not available`);
          }
        }
        
        // Step 3: Update the current phase state (only if component is still mounted)
        if (isMountedRef.current) {
          setCurrentPhase(phase);
        }
      };
      
      handlePhaseChange();
    }

    // Cleanup function to clear intervals and prevent state updates after unmount
    return () => {
      // Clear any active interval from handlePhaseChange
      if (phaseChangeIntervalRef.current) {
        clearInterval(phaseChangeIntervalRef.current);
        phaseChangeIntervalRef.current = null;
      }
    };
  }, [phase, currentPhase]);


  // In the VideoRecorder component, get the game name:
  const getGameDetails = async () => {
    try {
      const { orgId } = await getCurrentOrgContext();
      if (gameID) {
        return getGameNameByUUID(gameID, orgId);
      } else if (curricularID) {
        // If no game ID but we have level ID, find what game contains this level
        return getGameNameByLevelUUID(curricularID, orgId);
      }
      return 'NoGameID';
    } catch (error) {
      console.error('Error getting game details:', error);
      return 'GameNameNotFound';
    }
  };

  // And get the level name:
  const getLevelDetails = async () => {
    try {
      const { orgId } = await getCurrentOrgContext();
      if (curricularID) {
        return getLevelNameByUUID(curricularID, orgId);
      }
      return 'UnknownLevel';
    } catch (error) {
      console.error('Error getting level details:', error);
      return 'UnknownLevel';
    }
  };

  // Get game name from gameID
  // const getGameName = async () => {
  //   try {
  //     const gameData = await getCurricularDataByUUID(gameID);
  //     if (gameData) {
  //       // Extract the first key in the returned object
  //       const gameKey = Object.keys(gameData)[0];
  //       return gameData[gameKey].CurricularName; 
  //     }
  //     return 'UnknownGame';
  //   } catch (error) {
  //     console.error('Error getting game name:', error);
  //     return 'UnknownGame';
  //   }
  // };

  // // Get level name from curricularID
  // const getLevelName = async () => {
  //   try {
  //     const levelData = await getCurricularDataByUUID(curricularID);
  //     if (levelData) {
  //       // Extract the first key in the returned object
  //       const levelKey = Object.keys(levelData)[0];
  //       return levelData[levelKey].CurricularName;
  //     }
  //     return 'UnknownLevel';
  //   } catch (error) {
  //     console.error('Error getting level name:', error);
  //     return 'UnknownLevel';
  //   }
  // };

  // Format the event type (Insight, Intuition, etc.)
  const formatEventType = (eventType) => {
    return eventType.charAt(0).toUpperCase() + eventType.slice(1);
  };

  // Check Firebase Storage availability
  const checkStorageAvailability = () => {
    try {
      if (storage && typeof storage !== 'undefined') {
        // Try to create ref for checking
        const testRef = ref(storage, 'test');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Function to download video to computer
  const downloadVideoToComputer = (blob, filename) => {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log(`Video downloaded to computer: ${filename}`);
    } catch (error) {
      console.error('Error downloading video:', error);
    }
  };

  // Upload the video to Firebase Storage or download locally
  const uploadVideo = async (blob, filename, recordingPhase) => {
    const isStorageAvailable = checkStorageAvailability();
    
    // If Storage unavailable, download locally
    if (!isStorageAvailable) {
      console.log(`Storage not available, downloading video locally: ${filename}`);
      downloadVideoToComputer(blob, filename);
      return null;
    }

    try {
      const fileSizeMB = (blob.size / 1024 / 1024).toFixed(2);
      console.log(`Uploading video for phase: ${recordingPhase}, filename: ${filename}, size: ${fileSizeMB} MB`);
      
      // Ensure storage is initialized
      const storageInstance = storage || getStorage(app);
      if (!storageInstance) {
        throw new Error('Storage is not initialized');
      }
      
      const videoRef = ref(storageInstance, `videos/${filename}`);
      
      // Determine contentType based on file extension
      const contentType = filename.endsWith('.webm') ? 'video/webm' : 'video/mp4';
      
      // Use uploadBytesResumable for reliable upload with resume support
      const uploadTask = uploadBytesResumable(videoRef, blob, {
        contentType: contentType,
        customMetadata: {
          phase: recordingPhase || 'unknown',
          uploadedAt: new Date().toISOString()
        }
      });

      // Wait for upload completion with progress handling
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Track upload progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload progress: ${progress.toFixed(1)}%`);
          },
          (error) => {
            // Handle errors during upload
            console.error('Upload error:', error);
            // If upload failed, download locally
            console.log('Upload failed, downloading locally instead');
            downloadVideoToComputer(blob, filename);
            reject(error);
          },
          async () => {
            // Upload completed successfully
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('Video uploaded successfully:', downloadURL);
              resolve(downloadURL);
            } catch (error) {
              console.error('Error getting download URL:', error);
              // If getting URL failed, download locally
              downloadVideoToComputer(blob, filename);
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error uploading video:', error);
      // In case of error, download locally
      downloadVideoToComputer(blob, filename);
      throw error;
    }
  };

  // Function for immediate video processing (upload or download)
  const processVideoImmediately = async (blob, filename, phase) => {
    try {
      await uploadVideo(blob, filename, phase);
      // If processing successful, return true
      return true;
    } catch (error) {
      // If processing failed, return false
      console.error(`Failed to process video ${filename}:`, error);
      return false;
    }
  };

  // Function to select compatible recording format
  const getSupportedMimeType = () => {
    const formats = [
      'video/webm; codecs=vp9,opus',
      'video/webm; codecs=vp8,opus',
      'video/webm; codecs=vp9',
      'video/webm; codecs=vp8',
      'video/mp4; codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4; codecs=avc1.42E01E',
      'video/webm',
      'video/mp4'
    ];

    for (const format of formats) {
      if (MediaRecorder.isTypeSupported(format)) {
        console.log(`Selected supported format: ${format}`);
        return format;
      }
    }

    // Fallback - use empty string, browser will choose default format
    console.warn('No specific format supported, using browser default');
    return '';
  };

  // Function to wait for stream readiness
  const waitForStream = async (timeout = 10000) => {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms
    
    return new Promise((resolve) => {
      const checkStream = setInterval(() => {
        if (streamRef.current) {
          clearInterval(checkStream);
          resolve(true);
        } else if (Date.now() - startTime >= timeout) {
          clearInterval(checkStream);
          console.warn('Timeout waiting for video stream');
          resolve(false);
        }
      }, checkInterval);
    });
  };

  const startRecording = async (recordingPhase) => {
    // Check settings before recording
    const settings = await getUserSettings();
    if (!settings?.videoRecording) {
      console.log(`[VideoRecorder] Video recording disabled in settings for phase: ${recordingPhase}`);
      return;
    }
    
    console.log(`[VideoRecorder] Starting recording for phase: ${recordingPhase}`);

    recordedChunksRef.current = [];
    
    // Configure getUserMedia with audioRecording consideration
    const audioEnabled = settings?.audioRecording !== false;
    
    // Get video stream from MediaPipe (should already be in streamRef.current)
    if (!streamRef.current) {
      console.warn('Video stream not available from streamRef, attempting to get from input-video element');
      // Try to get stream directly from input-video element
      const inputVideo = document.getElementsByClassName("input-video")[0];
      if (inputVideo && inputVideo.srcObject) {
        try {
          // Clone stream for independent recording
          streamRef.current = inputVideo.srcObject.clone();
          console.log('Successfully obtained stream from input-video element');
        } catch (cloneError) {
          console.error('Failed to clone stream from input-video:', cloneError);
          console.warn('Cannot start recording: video stream not available');
          return;
        }
      } else {
        console.warn('Cannot start recording: video stream not available from MediaPipe or input-video');
        return;
      }
    }

    // Check for audio tracks in current stream
    const videoStream = streamRef.current;
    const hasAudioTracks = videoStream.getAudioTracks().length > 0;
    const videoTracks = videoStream.getVideoTracks();
    
    console.log(`Video stream info - Video tracks: ${videoTracks.length}, Audio tracks: ${hasAudioTracks ? videoStream.getAudioTracks().length : 0}`);

    let finalStream = videoStream;

    // If audio enabled in settings but missing in stream, get separate audio stream
    if (audioEnabled && !hasAudioTracks) {
      try {
        console.log('Audio enabled but not in video stream, requesting separate audio stream...');
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });

        const audioTracks = audioStream.getAudioTracks();
        console.log(`Obtained ${audioTracks.length} audio track(s)`);

        // Save reference to audio stream for proper cleanup
        audioStreamRef.current = audioStream;

        // Create new stream combining video tracks from MediaPipe with audio tracks
        finalStream = new MediaStream();
        
        // Add all video tracks
        videoTracks.forEach(track => {
          finalStream.addTrack(track);
          console.log(`Added video track: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`);
        });
        
        // Add all audio tracks
        audioTracks.forEach(track => {
          finalStream.addTrack(track);
          console.log(`Added audio track: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`);
        });

        // Stop old stream and replace with new combined stream
        if (streamRef.current !== finalStream) {
          streamRef.current.getTracks().forEach(track => {
            if (track.kind === 'audio') {
              track.stop();
            }
          });
        }
        streamRef.current = finalStream;

        console.log(`Final stream - Video tracks: ${finalStream.getVideoTracks().length}, Audio tracks: ${finalStream.getAudioTracks().length}`);
      } catch (audioError) {
        console.error("Failed to get audio stream:", audioError);
        console.log("Continuing with video-only recording");
        // Continue with video stream without audio
      }
    } else if (!audioEnabled) {
      console.log('Audio recording disabled in settings');
      // Remove audio tracks if they exist but audio is disabled
      if (hasAudioTracks) {
        finalStream = new MediaStream();
        videoTracks.forEach(track => finalStream.addTrack(track));
        streamRef.current.getAudioTracks().forEach(track => track.stop());
        streamRef.current = finalStream;
        console.log('Removed audio tracks (audio disabled in settings)');
      }
    } else {
      console.log(`Audio already present in stream: ${finalStream.getAudioTracks().length} track(s)`);
    }

    // Final check of tracks before recording
    const finalVideoTracks = finalStream.getVideoTracks().length;
    const finalAudioTracks = finalStream.getAudioTracks().length;
    console.log(`Starting recording with - Video tracks: ${finalVideoTracks}, Audio tracks: ${finalAudioTracks}`);

    try {
      // Store the phase at the start of recording - this won't change even if app phase changes
      recordingPhaseRef.current = recordingPhase;
      console.log(`Setting up recording for phase: ${recordingPhase}`);
      
      // Select compatible recording format
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      
      console.log(`Using MediaRecorder options:`, options);
      mediaRecorderRef.current = new MediaRecorder(finalStream, options);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // Use the phase that was active when recording started
      const recordingPhaseValue = recordingPhase;
      
      // Stop the recording, get metadata, and upload/download the video
      mediaRecorderRef.current.onstop = async () => {
        if (!isMountedRef.current) {
          console.warn('Component unmounted, skipping video processing');
          return;
        }

        console.log(`Recording stopped for phase: ${recordingPhaseValue}`);
        if (recordedChunksRef.current.length === 0) {
          console.warn('No recorded chunks available');
          return;
        }
        
        // Determine mimeType and file extension
        const mimeType = mediaRecorderRef.current.mimeType || 'video/webm';
        const fileExtension = mimeType.includes('webm') ? 'webm' : 'mp4';
        console.log(`Recording mimeType: ${mimeType}, file extension: ${fileExtension}`);
        
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        
        try {
          // Get all the necessary data for the filename
          const currentDate = new Date();
          const formattedDate = `${currentDate.getFullYear()}${(currentDate.getMonth() + 1)
            .toString().padStart(2, "0")}${currentDate.getDate().toString().padStart(2, "0")}_${currentDate.getHours().toString().padStart(2, "0")}h${currentDate.getMinutes().toString().padStart(2, "0")}m${currentDate.getSeconds().toString().padStart(2, "0")}s`;
            
          const username = await getUserNameFromDatabase();
          const participantID = username ? username.padStart(3, '0') : '000';
          
          const gameNameResult = await getGameDetails();
          const gameNameFormatted = gameNameResult.replace(/\s+/g, '');

          const levelNameResult = await getLevelDetails();
          
          // Use the phase that was captured when recording started
          const eventType = formatEventType(recordingPhaseValue || 'unknown');
          
          // Create the filename with the correct phase and extension
          const filename = `${formattedDate}_${participantID}_${gameNameFormatted}_${levelNameResult}_${eventType}.${fileExtension}`;
          
          console.log('Generated filename:', filename);
          console.log('Using event type:', eventType, 'from recording phase:', recordingPhaseValue);
          
          // Create record with metadata (blob will be added only on error)
          const videoData = {
            filename,
            phase: recordingPhaseValue,
            timestamp: Date.now(),
            processed: false,
            blob: null // blob will be added only if processing failed
          };
          
          // Process video immediately
          const processed = await processVideoImmediately(blob, filename, recordingPhaseValue);
          
          if (processed) {
            // Processing successful - save only metadata, blob not needed
            videoData.processed = true;
            console.log(`Video processed successfully: ${filename}`);
          } else {
            // Processing failed - save blob for retry
            videoData.blob = blob;
            videoData.processed = false;
            console.warn(`Video processing failed, blob saved for retry: ${filename}`);
          }
          
          // Save record (with blob only if processing failed)
          recordedVideosRef.current.push(videoData);
          
        } catch (error) {
          console.error('Error generating filename or uploading video:', error);
          const mimeType = mediaRecorderRef.current.mimeType || 'video/webm';
          const fileExtension = mimeType.includes('webm') ? 'webm' : 'mp4';
          const fallbackFilename = `video_${new Date().getTime()}_${recordingPhaseValue || 'unknown'}.${fileExtension}`;
          
          // Create record with fallback name
          const videoData = {
            filename: fallbackFilename,
            phase: recordingPhaseValue || 'unknown',
            timestamp: Date.now(),
            processed: false,
            blob: null
          };
          
          // Try to process with fallback name
          const processed = await processVideoImmediately(blob, fallbackFilename, recordingPhaseValue || 'unknown');
          
          if (processed) {
            videoData.processed = true;
            console.log(`Video processed with fallback filename: ${fallbackFilename}`);
          } else {
            // Save blob for retry
            videoData.blob = blob;
            videoData.processed = false;
            console.warn(`Fallback processing also failed, blob saved: ${fallbackFilename}`);
          }
          
          recordedVideosRef.current.push(videoData);
        }
      };
      
      mediaRecorderRef.current.start();
      console.log(`[VideoRecorder] Recording started successfully for phase: ${recordingPhase}`);
    } catch (e) {
      console.error("Error creating MediaRecorder", e);
    }
  };

  // Function to process remaining unprocessed videos
  const checkAndProcessRemainingVideos = async () => {
    if (!isMountedRef.current) {
      console.warn('Component unmounted, cannot process videos');
      return;
    }

    const videos = recordedVideosRef.current;
    if (videos.length === 0) {
      console.log('No videos recorded');
      return;
    }

    // Filter only unprocessed videos (where blob exists)
    const unprocessedVideos = videos.filter(v => !v.processed && v.blob !== null);
    
    if (unprocessedVideos.length === 0) {
      console.log(`All ${videos.length} video(s) already processed`);
      return;
    }

    console.log(`Processing ${unprocessedVideos.length} unprocessed video(s) out of ${videos.length} total...`);
    
    for (const video of unprocessedVideos) {
      if (!video.blob) {
        console.warn(`Video ${video.filename} has no blob, skipping`);
        continue;
      }

      try {
        const processed = await processVideoImmediately(video.blob, video.filename, video.phase);
        if (processed) {
          video.processed = true;
          video.blob = null; // Free memory
          console.log(`Successfully processed: ${video.filename}`);
        } else {
          console.warn(`Failed to process: ${video.filename}, will retry later`);
        }
      } catch (error) {
        console.error(`Error processing ${video.filename}:`, error);
      }
    }
    
    const stillUnprocessed = videos.filter(v => !v.processed && v.blob !== null).length;
    console.log(`Processing complete. ${stillUnprocessed} video(s) still need processing.`);
  };

  // Function to download all recorded videos (processes only unprocessed)
  const downloadAllRecordedVideos = async () => {
    await checkAndProcessRemainingVideos();
  };

  // Export methods via ref
  useImperativeHandle(ref, () => ({
    downloadAllVideos: downloadAllRecordedVideos,
    getRecordedVideos: () => recordedVideosRef.current
  }));

  // Cleanup on unmount - process remaining videos
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Process remaining unprocessed videos on unmount
      const videos = recordedVideosRef.current;
      if (videos.length > 0) {
        const unprocessed = videos.filter(v => !v.processed && v.blob !== null);
        const processed = videos.filter(v => v.processed).length;
        
        console.log(`Component unmounting. Videos: ${videos.length} total, ${processed} processed, ${unprocessed.length} unprocessed`);
        
        if (unprocessed.length > 0) {
          console.log('Processing remaining unprocessed videos...');
          // Use synchronous version for cleanup
          checkAndProcessRemainingVideos().catch(error => {
            console.error('Error processing remaining videos on unmount:', error);
          });
        }
      }
      
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.warn('Error stopping recorder on unmount:', e);
        }
      }
      
      // Stop stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      
      // Stop separate audio stream if it was created
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
    };
  }, []);

  // This component does not render any UI
  return null;
});

VideoRecorder.displayName = 'VideoRecorder';

export default VideoRecorder;