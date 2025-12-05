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
  const recordingPhaseRef = useRef(null);
  const recordedVideosRef = useRef([]); // Хранилище всех записанных видео
  const isMountedRef = useRef(true);
  const [state, send] = useMachine(LevelPlayMachine);

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
    };
  }, []);

  // When the phase prop changes, handle recording changes with proper sequencing
  useEffect(() => {
    if (phase !== currentPhase) {
      console.log(`Phase changing from ${currentPhase} to ${phase}`);
      
      const handlePhaseChange = async () => {
        // Step 1: Stop the current recording if one is active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log(`Stopping recording for phase: ${recordingPhaseRef.current}`);
          mediaRecorderRef.current.stop();
          
          // Wait for the recording to fully stop before starting a new one
          // This ensures the onstop handler completes before a new recording starts
          await new Promise(resolve => {
            const checkRecording = setInterval(() => {
              if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                clearInterval(checkRecording);
                resolve();
              }
            }, 100);
          });
        }
        
        // Step 2: Start a new recording if we have a new phase
        if (phase) {
          console.log(`Starting new recording for phase: ${phase}`);
          startRecording(phase); // Pass the current phase
        }
        
        // Step 3: Update the current phase state
        setCurrentPhase(phase);
      };
      
      handlePhaseChange();
    }
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

  // Проверка доступности Firebase Storage
  const checkStorageAvailability = () => {
    try {
      if (storage && typeof storage !== 'undefined') {
        // Попробовать создать ref для проверки
        const testRef = ref(storage, 'test');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Функция скачивания видео на компьютер
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

  // Upload the video to Firebase Storage или скачать локально
  const uploadVideo = async (blob, filename, recordingPhase) => {
    const isStorageAvailable = checkStorageAvailability();
    
    // Если Storage недоступен, скачиваем локально
    if (!isStorageAvailable) {
      console.log(`Storage not available, downloading video locally: ${filename}`);
      downloadVideoToComputer(blob, filename);
      return null;
    }

    try {
      const fileSizeMB = (blob.size / 1024 / 1024).toFixed(2);
      console.log(`Uploading video for phase: ${recordingPhase}, filename: ${filename}, size: ${fileSizeMB} MB`);
      
      // Убедиться, что storage инициализирован
      const storageInstance = storage || getStorage(app);
      if (!storageInstance) {
        throw new Error('Storage is not initialized');
      }
      
      const videoRef = ref(storageInstance, `videos/${filename}`);
      
      // Используем uploadBytesResumable для надежной загрузки с поддержкой возобновления
      const uploadTask = uploadBytesResumable(videoRef, blob, {
        contentType: 'video/mp4',
        customMetadata: {
          phase: recordingPhase || 'unknown',
          uploadedAt: new Date().toISOString()
        }
      });

      // Ожидаем завершения загрузки с обработкой прогресса
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Отслеживание прогресса загрузки
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload progress: ${progress.toFixed(1)}%`);
          },
          (error) => {
            // Обработка ошибок во время загрузки
            console.error('Upload error:', error);
            // Если загрузка не удалась, скачиваем локально
            console.log('Upload failed, downloading locally instead');
            downloadVideoToComputer(blob, filename);
            reject(error);
          },
          async () => {
            // Загрузка завершена успешно
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('Video uploaded successfully:', downloadURL);
              resolve(downloadURL);
            } catch (error) {
              console.error('Error getting download URL:', error);
              // Если получение URL не удалось, скачиваем локально
              downloadVideoToComputer(blob, filename);
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error uploading video:', error);
      // В случае ошибки скачиваем локально
      downloadVideoToComputer(blob, filename);
      throw error;
    }
  };

  const startRecording = async (recordingPhase) => {
    // Проверяем настройки перед записью
    const settings = await getUserSettings();
    if (!settings?.videoRecording) {
      console.log('Video recording disabled in settings');
      return;
    }

    recordedChunksRef.current = [];
    
    // Настройка getUserMedia с учетом audioRecording
    const audioEnabled = settings?.audioRecording !== false;
    
    if (!streamRef.current) {
      try {
        const mediaConstraints = {
          video: true,
          audio: audioEnabled ? {
            echoCancellation: true,
            noiseSuppression: true
          } : false
        };
        
        streamRef.current = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        console.log("Audio tracks is included:", streamRef.current.getAudioTracks().length > 0);
        console.log(`Recording with audio: ${audioEnabled}`);
      } catch (error) {
        console.error("Media device access failed:", error);
        // Если доступ к аудио не удался, пробуем только видео
        if (audioEnabled) {
          try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
            console.log("Falling back to video-only recording");
          } catch (videoError) {
            console.error("Video device access also failed:", videoError);
            return;
          }
        } else {
          // Если аудио отключено в настройках, просто записываем видео
          try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (videoError) {
            console.error("Video device access failed:", videoError);
            return;
          }
        }
      }
    }

    try {
      // Store the phase at the start of recording - this won't change even if app phase changes
      recordingPhaseRef.current = recordingPhase;
      console.log(`Setting up recording for phase: ${recordingPhase}`);
      
      const options = { mimeType: 'video/mp4; codecs=vp9,opus' };
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      
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
        
        const blob = new Blob(recordedChunksRef.current, { type: mediaRecorderRef.current.mimeType });
        
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
          
          // Create the filename with the correct phase
          const filename = `${formattedDate}_${participantID}_${gameNameFormatted}_${levelNameResult}_${eventType}.mp4`;
          
          console.log('Generated filename:', filename);
          console.log('Using event type:', eventType, 'from recording phase:', recordingPhaseValue);
          
          // Сохраняем видео в массив для последующего скачивания
          const videoData = {
            blob,
            filename,
            phase: recordingPhaseValue,
            timestamp: Date.now()
          };
          recordedVideosRef.current.push(videoData);
          
          // Загружаем или скачиваем видео (uploadVideo сам решит, что делать)
          await uploadVideo(blob, filename, recordingPhaseValue);
          
        } catch (error) {
          console.error('Error generating filename or uploading video:', error);
          const fallbackFilename = `video_${new Date().getTime()}_${recordingPhaseValue || 'unknown'}.mp4`;
          
          // Сохраняем с fallback именем
          const videoData = {
            blob,
            filename: fallbackFilename,
            phase: recordingPhaseValue,
            timestamp: Date.now()
          };
          recordedVideosRef.current.push(videoData);
          
          try {
            await uploadVideo(blob, fallbackFilename, recordingPhaseValue || 'unknown');
          } catch (fallbackError) {
            console.error('Fallback upload also failed:', fallbackError);
          }
        }
      };
      
      mediaRecorderRef.current.start();
      console.log(`Recording started for phase: ${recordingPhase}`);
    } catch (e) {
      console.error("Error creating MediaRecorder", e);
    }
  };

  // Функция для скачивания всех записанных видео
  const downloadAllRecordedVideos = async () => {
    if (!isMountedRef.current) {
      console.warn('Component unmounted, cannot download videos');
      return;
    }

    const videos = recordedVideosRef.current;
    if (videos.length === 0) {
      console.log('No videos recorded to download');
      return;
    }

    console.log(`Downloading ${videos.length} recorded video(s)...`);
    const isStorageAvailable = checkStorageAvailability();
    
    for (const video of videos) {
      if (isStorageAvailable) {
        try {
          await uploadVideo(video.blob, video.filename, video.phase);
        } catch (error) {
          console.error(`Failed to upload ${video.filename}, downloading locally:`, error);
          downloadVideoToComputer(video.blob, video.filename);
        }
      } else {
        downloadVideoToComputer(video.blob, video.filename);
      }
    }
    
    console.log('All videos processed');
  };

  // Экспортируем методы через ref
  useImperativeHandle(ref, () => ({
    downloadAllVideos: downloadAllRecordedVideos,
    getRecordedVideos: () => recordedVideosRef.current
  }));

  // Cleanup при размонтировании - скачиваем все видео
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Скачиваем все видео при размонтировании
      if (recordedVideosRef.current.length > 0) {
        console.log('Component unmounting, downloading all recorded videos...');
        downloadAllRecordedVideos();
      }
      
      // Останавливаем запись
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.warn('Error stopping recorder on unmount:', e);
        }
      }
      
      // Останавливаем стрим
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // This component does not render any UI
  return null;
});

VideoRecorder.displayName = 'VideoRecorder';

export default VideoRecorder;