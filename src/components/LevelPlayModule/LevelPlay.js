import { useMachine } from '@xstate/react';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import VideoRecorder from '../VideoRecorder';
import Chapter from '../Chapter';
import ConjecturePoseContainter from '../ConjecturePoseMatch/ConjecturePoseContainer';
import ExperimentalTask from '../ExperimentalTask';
import Tween from '../Tween';
import LevelPlayMachine from './LevelPlayMachine';
import {
  getConjectureDataByUUIDWithCurrentOrg,
  writeToDatabaseTweenStart,
  writeToDatabaseTweenEnd,
  writeToDatabasePoseMatchingStart,
  writeToDatabasePoseMatchingEnd,
  writeToDatabaseIntuitionStart,
  writeToDatabaseIntuitionEnd,
  writeToDatabaseMCQStart,
  writeToDatabaseMCQEnd,
  writeToDatabaseOutroStart,
  writeToDatabaseOutroEnd,
} from '../../firebase/database';
import { getUserSettings } from '../../firebase/userSettings';
import NewStage from '../NewStage';
import Button from '../Button';
import { red, white } from '../../utils/colors';
import { Text, Container } from '@inlet/react-pixi';
import PixiLoader from '../utilities/PixiLoader';

export default function LevelPlay(props) {
  const {
    columnDimensions,
    poseData,
    rowDimensions,
    debugMode,
    onLevelComplete,
    UUID,
    width,
    height,
    backCallback,
    currentConjectureIdx,
    gameID,
    hasShownIntro,
    markIntroShown,
  } = props;

  if (!UUID || currentConjectureIdx === undefined || isNaN(currentConjectureIdx)) {
    console.warn('🚫 Skipping render — invalid UUID or chapter index', {
      UUID,
      currentConjectureIdx,
    });
    return null;
  }

  const [state, send] = useMachine(LevelPlayMachine);
  const [conjectureData, setConjectureData] = useState(null);
  const [poses, setPoses] = useState([]);
  const [tolerances, setTolerances] = useState([]);
  const [expText, setExpText] = useState('');
  const [settings, setSettings] = useState(null);
  
  // Memoize the result of hasShownIntro to avoid infinite re-renders
  const hasShownIntroResult = useMemo(() => {
    return hasShownIntro ? hasShownIntro(currentConjectureIdx) : false;
  }, [hasShownIntro, currentConjectureIdx]);
  
  // Log state transitions
  useEffect(() => {
    console.log('[LevelPlay] State transition:', {
      state: state.value,
      settings: settings ? {
        story: settings.story,
        tween: settings.tween,
        poseMatching: settings.poseMatching,
        intuition: settings.intuition,
        insight: settings.insight,
        multipleChoice: settings.multipleChoice
      } : 'not loaded',
      conjectureData: !!conjectureData,
      posesLoaded: poses.length > 0
    });
  }, [state.value, settings, conjectureData, poses.length]);
  
  React.useEffect(() => {
    send("RESET_CONTEXT");
  }, [currentConjectureIdx, send]);
  const [repetitionCountFromDB, setRepetitionCountFromDB] = useState(null);
  const [isLoadingPoses, setIsLoadingPoses] = useState(true);
  // default repetitions fallback
  const repetitionCount = (repetitionCountFromDB && Number.isInteger(repetitionCountFromDB))
    ? Math.max(1, repetitionCountFromDB)
    : (settings && Number.isInteger(settings.repetitions) ? Math.max(1, settings.repetitions) : 3);
  const tweenDuration = 2000;
  const tweenLoopCount = settings?.repetitions ?? 3;

  // Refs for tracking previous state and video recorder
  const prevStateRef = useRef(null);
  const videoRecorderRef = useRef(null);

  // Memoize onComplete callback to prevent timer resets in child components
  const handleNext = useCallback(() => {
    console.log('[LevelPlay] handleNext called, current state:', state.value);
    send('NEXT');
  }, [send, state.value]);

  /* ---------- load conjecture data ---------- */
  useEffect(() => {
    console.log('[LevelPlay] Starting to load conjecture data for UUID:', UUID);
    setIsLoadingPoses(true);
    getConjectureDataByUUIDWithCurrentOrg(UUID)
      .then((d) => {
        console.log('[LevelPlay] Data loaded from database:', {
          'UUID': UUID,
          'data keys': d ? Object.keys(d) : null,
          'data structure': d ? Object.keys(d[UUID] || {}) : null,
          'full data': d
        });
        setConjectureData(d);
        // Read repetitions from the database record if present
        try {
          const raw = d?.[UUID]?.Repetitions ?? d?.[UUID]?.repetitions;
          if (raw != null) {
            const parsed = parseInt(String(raw), 10);
            if (!Number.isNaN(parsed) && parsed >= 1) {
              setRepetitionCountFromDB(parsed);
            } else {
              setRepetitionCountFromDB(null);
            }
          } else {
            setRepetitionCountFromDB(null);
          }
        } catch (e) {
          console.warn("Failed to parse Repetitions from DB:", e);
          setRepetitionCountFromDB(null);
        }
        
        // Check if poses exist in data
        if (!d || !d[UUID]) {
          console.error('[LevelPlay] No data found for UUID:', UUID);
          setIsLoadingPoses(false);
          return;
        }
        
        const hasStartPose = d[UUID]['Start Pose'];
        const hasIntermediatePose = d[UUID]['Intermediate Pose'];
        const hasEndPose = d[UUID]['End Pose'];
        
        console.log('[LevelPlay] Pose data check:', {
          'hasStartPose': !!hasStartPose,
          'hasIntermediatePose': !!hasIntermediatePose,
          'hasEndPose': !!hasEndPose,
          'startPose structure': hasStartPose ? Object.keys(hasStartPose) : null,
          'startPose has poseData': hasStartPose ? !!hasStartPose.poseData : null
        });
        
        if (!hasStartPose || !hasIntermediatePose || !hasEndPose) {
          console.error('[LevelPlay] Missing pose data:', {
            'Start Pose': !!hasStartPose,
            'Intermediate Pose': !!hasIntermediatePose,
            'End Pose': !!hasEndPose
          });
          setIsLoadingPoses(false);
          return;
        }
        
        const { ['Start Pose']: s, ['Intermediate Pose']: i, ['End Pose']: e } = d[UUID];
        
        console.log('[LevelPlay] Parsing pose data:', {
          'startPoseData length': s.poseData ? s.poseData.length : 0,
          'intermediatePoseData length': i.poseData ? i.poseData.length : 0,
          'endPoseData length': e.poseData ? e.poseData.length : 0
        });
        
        try {
          const parsedPoses = [
            JSON.parse(s.poseData),
            JSON.parse(i.poseData),
            JSON.parse(e.poseData),
          ];
          console.log('[LevelPlay] Poses parsed successfully:', {
            'poses count': parsedPoses.length,
            'first pose keys': parsedPoses[0] ? Object.keys(parsedPoses[0]) : null
          });
          setPoses(parsedPoses);
        } catch (parseError) {
          console.error('[LevelPlay] Error parsing pose data:', parseError);
          setIsLoadingPoses(false);
          return;
        }
        
        const tolArray = [s, i, e].map((pose) =>
          typeof pose.tolerance === 'string' || typeof pose.tolerance === 'number'
            ? parseInt(pose.tolerance)
            : null
        );
        console.log('[LevelPlay] Tolerances set:', tolArray);
        setTolerances(tolArray);
        setIsLoadingPoses(false);
        console.log('[LevelPlay] Data loading completed successfully');
      })
      .catch((error) => {
        console.error("[LevelPlay] Error loading conjecture data:", error);
        setIsLoadingPoses(false);
      });
  }, [UUID]);

  /* ---------- phase event tracking ---------- */
  useEffect(() => {
    if (!gameID) return;

    if (state.value === 'tween') {
      writeToDatabaseTweenStart(gameID, UUID).catch(console.error);
    } else if (state.value === 'poseMatching') {
      writeToDatabasePoseMatchingStart(gameID).catch(console.error);
    } else if (state.value === 'intuition' && conjectureData) {
      const textBoxes = conjectureData[UUID]['Text Boxes'];
      const desc = textBoxes['Conjecture Statement'] || textBoxes['Intuition Description'] || textBoxes['Conjecture Description'] || '';
      writeToDatabaseIntuitionStart(gameID, desc).catch(console.error);
    } else if (state.value === 'mcq' && conjectureData) {
      const textBoxes = conjectureData[UUID]['Text Boxes'];
      const question = textBoxes['Conjecture Statement'] || textBoxes['MCQ Question'] || '';
      writeToDatabaseMCQStart(gameID, question).catch(console.error);
    } else if (state.value === 'outroDialogue') {
      writeToDatabaseOutroStart(gameID).catch(console.error);
    }
  }, [state.value, gameID, conjectureData, UUID]);

  /* ---------- phase end event tracking ---------- */
  useEffect(() => {
    if (!gameID) return;

    // Track previous state to detect transitions
    if (prevStateRef.current === 'tween' && state.value !== 'tween') {
      writeToDatabaseTweenEnd(gameID, UUID).catch(console.error);
    } else if (prevStateRef.current === 'poseMatching' && state.value !== 'poseMatching') {
      writeToDatabasePoseMatchingEnd(gameID).catch(console.error);
    } else if (prevStateRef.current === 'mcq' && state.value !== 'mcq') {
      writeToDatabaseMCQEnd(gameID).catch(console.error);
    } else if (prevStateRef.current === 'outroDialogue' && state.value !== 'outroDialogue') {
      writeToDatabaseOutroEnd(gameID).catch(console.error);
    }

    prevStateRef.current = state.value;
  }, [state.value, gameID]);

  /* ---------- experimental prompt ---------- */
  useEffect(() => {
    if (!conjectureData) return;
    const textBoxes = conjectureData[UUID]['Text Boxes'];
    // Use Conjecture Statement if available, fallback to old fields for backward compatibility
    const desc = textBoxes['Conjecture Statement'] || textBoxes['Intuition Description'] || textBoxes['Conjecture Description'] || '';

    if (state.value === 'intuition') {
      setExpText(`${desc}\nDo you think this is TRUE or FALSE?`);
      writeToDatabaseIntuitionStart(gameID, desc).catch(console.error);
    } else if (state.value === 'insight') {
      setExpText(`Now explain WHY you think:\n\n${desc}\n\n is TRUE or FALSE?`);
      writeToDatabaseIntuitionEnd(gameID).catch(console.error);
    } else {
      setExpText('');
    }
  }, [state.value, conjectureData, UUID, gameID]);

  /* ---------- tween message (shown inside Tween for 1 s) ---------- */

      useEffect(() => {
        if (state.value !== 'tween') return;

        // create a plain DOM node so React-Pixi never sees it
        const banner = document.createElement('div');
        banner.textContent = 'Try to match these movements with your body';
        Object.assign(banner.style, {
          position: 'fixed',
          top: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '32px',
          textShadow: '0 0 4px #000',
          pointerEvents: 'none',
        });
        document.body.appendChild(banner);

        const timer = setTimeout(() => banner.remove(), tweenDuration * (tweenLoopCount+2000));

        return () => {
          clearTimeout(timer);
          banner.remove();
        };
      }, [state.value]);

  // Load settings when component mounts
  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      const userSettings = await getUserSettings();
      if (isMounted) {
        setSettings(userSettings);
      }
    };
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // If story is disabled, skip intro/outro so the game continues
  useEffect(() => {
    if (!settings) return;

    // Skip story intro/outro when story setting is disabled
    if (settings.story === false) {
      if (state.value === 'introDialogue') {
        // Ensure data is loaded before transitioning
        if (!conjectureData) {
          console.log('[LevelPlay] Skipping introDialogue transition - waiting for data to load');
          return;
        }
        
        console.log('[LevelPlay] Skipping introDialogue (story disabled), transitioning to tween');
        try {
          markIntroShown(currentConjectureIdx);
        } catch (e) {
          // no-op if markIntroShown isn't available
        }
        send('NEXT');
      }
      if (state.value === 'outroDialogue') {
        // Process remaining videos before completion (asynchronously, non-blocking)
        if (videoRecorderRef.current?.downloadAllVideos) {
          videoRecorderRef.current.downloadAllVideos().catch(error => {
            console.error('Error processing videos:', error);
          });
        }
        // Call onLevelComplete synchronously so PlayGame can properly handle completion
        onLevelComplete?.();
      }
    }

    // Skip the tween animation when the tween setting is disabled
    // (advance to the next state immediately)
    if (state.value === 'tween') {
      if (settings.tween === false) {
        console.log('[LevelPlay] Skipping tween (disabled), transitioning to next state');
        send('NEXT');
      } else {
        // Module is enabled, check if data is ready
        if (poses.length === 0 && isLoadingPoses) {
          console.log('[LevelPlay] Tween enabled but poses not loaded yet, waiting...', {
            posesLength: poses.length,
            isLoadingPoses: isLoadingPoses
          });
          // Don't skip, wait for poses to load
        } else if (poses.length === 0 && !isLoadingPoses) {
          console.log('[LevelPlay] Tween enabled but poses failed to load, skipping...', {
            posesLength: poses.length,
            isLoadingPoses: isLoadingPoses
          });
          send('NEXT');
        }
        // If poses.length > 0, component should render, don't skip
      }
    }

    // Skip the pose-matching module when the poseMatching setting is disabled
    if (state.value === 'poseMatching') {
      if (settings.poseMatching === false) {
        console.log('[LevelPlay] Skipping poseMatching (disabled), transitioning to next state', {
          settingsPoseMatching: settings.poseMatching,
          posesLength: poses.length,
          isLoadingPoses: isLoadingPoses
        });
        send('NEXT');
      } else {
        // Module is enabled, check if data is ready
        if (poses.length === 0 && isLoadingPoses) {
          console.log('[LevelPlay] PoseMatching enabled but poses not loaded yet, waiting...', {
            posesLength: poses.length,
            isLoadingPoses: isLoadingPoses
          });
          // Don't skip, wait for poses to load
        } else if (poses.length === 0 && !isLoadingPoses) {
          console.log('[LevelPlay] PoseMatching enabled but poses failed to load, skipping...', {
            posesLength: poses.length,
            isLoadingPoses: isLoadingPoses
          });
          send('NEXT');
        }
        // If poses.length > 0 and !isLoadingPoses, component should render, don't skip
      }
    }

    // Skip the intuition module when the intuition setting is disabled
    if (settings.intuition === false && state.value === 'intuition') {
      console.log('[LevelPlay] Skipping intuition (disabled), transitioning to next state');
      send('NEXT');
    }

    // Skip the insight module when the insight setting is disabled
    if (state.value === 'insight') {
      if (settings.insight === false) {
        console.log('[LevelPlay] Skipping insight (disabled), transitioning to next state', {
          settingsInsight: settings.insight
        });
        send('NEXT');
      }
      // If enabled, component should render, don't skip
    }

    // Skip the multiple choice module when the multipleChoice setting is disabled
    if (state.value === 'mcq') {
      if (settings.multipleChoice === false) {
        console.log('[LevelPlay] Skipping mcq (disabled), transitioning to next state', {
          settingsMultipleChoice: settings.multipleChoice
        });
        send('NEXT');
      }
      // If enabled, component should render, don't skip
    }
  }, [settings, state.value, currentConjectureIdx, markIntroShown, send, onLevelComplete, conjectureData, poses.length, isLoadingPoses]);

  // Skip disabled game modules automatically (duplicate logic removed - handled in main useEffect above)
  // This useEffect is kept for backward compatibility but logic is now in the main useEffect

  // Log render conditions for introDialogue
  useEffect(() => {
    if (state.value === 'introDialogue') {
      const shouldRender = !hasShownIntroResult &&
        conjectureData && 
        settings?.story;
      
      console.log('[LevelPlay] IntroDialogue render check:', {
        'state.value': state.value,
        'hasShownIntro': hasShownIntroResult,
        'conjectureData exists': !!conjectureData,
        'settings?.story': settings?.story,
        'shouldRender Chapter': shouldRender
      });
    }
  }, [state.value, hasShownIntroResult, conjectureData, settings]);

  // Log render conditions for poseMatching
  useEffect(() => {
    if (state.value === 'poseMatching') {
      const shouldRender = !isLoadingPoses && poses.length > 0 && settings?.poseMatching !== false;
      console.log('[LevelPlay] PoseMatching render check:', {
        'state.value': state.value,
        'isLoadingPoses': isLoadingPoses,
        'poses.length': poses.length,
        'settings?.poseMatching': settings?.poseMatching,
        'shouldRender': shouldRender,
        'poses sample': poses.length > 0 ? poses[0] : null
      });
    }
  }, [state.value, isLoadingPoses, poses, settings]);

  // Auto-transition from introDialogue to tween when Chapter should not render
  useEffect(() => {
    if (state.value !== 'introDialogue') return;
    if (!settings || !conjectureData) return; // Wait for data to load
    
    // Check if Chapter should render
    const shouldRenderChapter = !hasShownIntroResult && 
                                 conjectureData && 
                                 settings?.story === true;
    
    // If Chapter should not render, automatically transition to tween
    if (!shouldRenderChapter) {
      console.log('[LevelPlay] Auto-transitioning from introDialogue to tween:', {
        'hasShownIntro': hasShownIntroResult,
        'conjectureData exists': !!conjectureData,
        'settings.story': settings?.story,
        'shouldRenderChapter': shouldRenderChapter
      });
      
      // Mark intro as shown if it hasn't been marked yet
      if (!hasShownIntroResult) {
        try {
          markIntroShown(currentConjectureIdx);
        } catch (e) {
          // no-op if markIntroShown isn't available
        }
      }
      
      send('NEXT');
    }
  }, [state.value, settings, conjectureData, hasShownIntroResult, currentConjectureIdx, markIntroShown, send]);

  // Handle completion when all modules are skipped after poseMatching
  useEffect(() => {
    if (!settings || state.value === 'levelEnd') return;
    
    // Check if we're in a state where all subsequent modules are disabled
    const isOutroDialogue = state.value === 'outroDialogue';
    const isIntuition = state.value === 'intuition';
    const isInsight = state.value === 'insight';
    const isMcq = state.value === 'mcq';
    
    // If we're in outroDialogue and story is disabled, complete the level
    if (isOutroDialogue && settings.story === false) {
      console.log('[LevelPlay] All modules completed, outroDialogue disabled, completing level');
      // Process remaining videos before completion (asynchronously, non-blocking)
      if (videoRecorderRef.current?.downloadAllVideos) {
        videoRecorderRef.current.downloadAllVideos().catch(error => {
          console.error('Error processing videos:', error);
        });
      }
      // Call onLevelComplete synchronously so PlayGame can properly handle completion
      onLevelComplete?.();
      return;
    }
    
    // Check if current state has no component to render (all modules disabled)
    const tweenCheck = state.value === 'tween' && settings.tween !== false && poses.length > 0;
    const poseMatchingCheck = state.value === 'poseMatching' && settings.poseMatching !== false && poses.length > 0 && !isLoadingPoses;
    const intuitionCheck = state.value === 'intuition' && settings.intuition !== false && conjectureData;
    const insightCheck = state.value === 'insight' && settings.insight !== false;
    const mcqCheck = state.value === 'mcq' && settings.multipleChoice !== false;
    const introDialogueCheck = state.value === 'introDialogue' && !hasShownIntroResult && conjectureData && settings.story === true;
    const outroDialogueCheck = state.value === 'outroDialogue' && conjectureData && settings.story === true;
    
    const hasComponentToRender = tweenCheck || poseMatchingCheck || intuitionCheck || insightCheck || mcqCheck || introDialogueCheck || outroDialogueCheck;
    
    // Log detailed check results
    if (isIntuition || isInsight || isMcq || isOutroDialogue || state.value === 'tween') {
      console.log('[LevelPlay] Component render checks for state:', state.value, {
        tweenCheck: state.value === 'tween' ? { result: tweenCheck, posesLength: poses.length, settingsTween: settings.tween } : 'N/A',
        poseMatchingCheck: state.value === 'poseMatching' ? { result: poseMatchingCheck, posesLength: poses.length, isLoadingPoses, settingsPoseMatching: settings.poseMatching } : 'N/A',
        intuitionCheck: state.value === 'intuition' ? { result: intuitionCheck, hasConjectureData: !!conjectureData, settingsIntuition: settings.intuition } : 'N/A',
        insightCheck: state.value === 'insight' ? { result: insightCheck, settingsInsight: settings.insight } : 'N/A',
        mcqCheck: state.value === 'mcq' ? { result: mcqCheck, settingsMultipleChoice: settings.multipleChoice } : 'N/A',
        introDialogueCheck: state.value === 'introDialogue' ? { result: introDialogueCheck, hasShownIntro: hasShownIntroResult, hasConjectureData: !!conjectureData, settingsStory: settings.story } : 'N/A',
        outroDialogueCheck: state.value === 'outroDialogue' ? { result: outroDialogueCheck, hasConjectureData: !!conjectureData, settingsStory: settings.story } : 'N/A',
        hasComponentToRender: hasComponentToRender
      });
    }
    
    // If no component to render, check if all subsequent modules are also disabled before completing
    if (!hasComponentToRender && (isIntuition || isInsight || isMcq || isOutroDialogue)) {
      let shouldCompleteLevel = false;
      
      if (isIntuition) {
        // If intuition is disabled, check if insight and mcq are also disabled
        const insightDisabled = settings.insight === false;
        const mcqDisabled = settings.multipleChoice === false;
        shouldCompleteLevel = insightDisabled && mcqDisabled;
        console.log('[LevelPlay] Intuition disabled, checking subsequent modules:', {
          insightDisabled,
          mcqDisabled,
          shouldCompleteLevel
        });
      } else if (isInsight) {
        // If insight is disabled, check if mcq is also disabled
        const mcqDisabled = settings.multipleChoice === false;
        shouldCompleteLevel = mcqDisabled;
        console.log('[LevelPlay] Insight disabled, checking subsequent modules:', {
          mcqDisabled,
          shouldCompleteLevel
        });
      } else if (isMcq) {
        // MCQ is the last module before outroDialogue, so if it's disabled, complete the level
        shouldCompleteLevel = true;
        console.log('[LevelPlay] MCQ disabled, completing level');
      } else if (isOutroDialogue) {
        // OutroDialogue is the last module, so if it's disabled, complete the level
        shouldCompleteLevel = true;
        console.log('[LevelPlay] OutroDialogue disabled, completing level');
      }
      
      if (shouldCompleteLevel) {
        console.log('[LevelPlay] No component to render in state:', state.value, 'all subsequent modules disabled, completing level');
        // Process remaining videos before completion (synchronously with await)
        if (videoRecorderRef.current?.downloadAllVideos) {
          videoRecorderRef.current.downloadAllVideos()
            .then(() => {
              console.log('[LevelPlay] Videos processed, completing level');
              onLevelComplete?.();
            })
            .catch(error => {
              console.error('Error processing videos:', error);
              // Complete level even if video processing fails
              onLevelComplete?.();
            });
        } else {
          // No videos to process, complete immediately
          onLevelComplete?.();
        }
      } else {
        console.log('[LevelPlay] No component to render in state:', state.value, 'but subsequent modules are enabled, allowing transition');
      }
    }
  }, [state.value, settings, conjectureData, poses.length, isLoadingPoses, currentConjectureIdx, hasShownIntroResult, onLevelComplete]);

  
  // Only show story/dialogue content if settings.story is true
  return (
    <>
      {/* NOTE: TO OPTIMIZE DATABASE STORAGE AND NOT INCUR ADDITIONAL COSTS, 
          VIDEO RECORDING IS ONLY RETAINED FOR THE STATES MENTIONED BELOW.
          SIMPLY ADD THE STATE NAME TO ENABLE RECORDING FOR THAT PHASE */}
      {/* TODO: Re-enable video recording after fixing CORS configuration in Firebase Storage */}
      {/* {(['tween','poseMatching', 'intuition', 'insight'].includes(state.value)) && (
        <VideoRecorder phase={state.value} curricularID={UUID} gameID={gameID} />
      )} */}

      {/* Intro dialogue */}
      {state.value === 'introDialogue' &&
        !hasShownIntroResult &&
        conjectureData && 
        settings?.story && (
          <Chapter
            key={`intro-${UUID}`}
            poseData={poseData}
            columnDimensions={columnDimensions}
            rowDimensions={rowDimensions}
            width={width}
            height={height}
            chapterConjecture={conjectureData[UUID]}
            currentConjectureIdx={currentConjectureIdx}
            nextChapterCallback={() => {
              markIntroShown(currentConjectureIdx);
              send('NEXT');
            }}
            isOutro={false}
          />
      )}
      {/* NOTE: TO OPTIMIZE DATABASE STORAGE AND NOT INCUR ADDITIONAL COSTS, 
          VIDEO RECORDING IS ONLY RETAINED FOR THE STATES MENTIONED BELOW.
          SIMPLY ADD THE STATE NAME TO ENABLE RECORDING FOR THAT PHASE */}
      {(['tween','poseMatching', 'intuition', 'insight', 'mcq'].includes(state.value)) && 
       settings?.videoRecording !== false &&
       ((state.value === 'tween' && settings?.tween !== false) ||
        (state.value === 'poseMatching' && settings?.poseMatching !== false) ||
        (state.value === 'intuition' && settings?.intuition !== false) ||
        (state.value === 'insight' && settings?.insight !== false) ||
        (state.value === 'mcq' && settings?.multipleChoice !== false)) && (
        <VideoRecorder 
          ref={videoRecorderRef}
          phase={state.value} 
          curricularID={UUID} 
          gameID={gameID} 
        />
      )}

      

      {/* Tween animation */}
      {(() => {
        if (state.value === 'tween') {
          // Check if module is enabled
          const isEnabled = settings?.tween !== false;
          // Check if poses are loaded or loading
          const hasPoses = poses.length > 0;
          const isLoading = isLoadingPoses;
          // Should render if enabled and (poses loaded OR still loading)
          const shouldRender = isEnabled && (hasPoses || isLoading);
          
          console.log('[LevelPlay] Tween render check:', {
            state: state.value,
            posesLength: poses.length,
            isLoadingPoses: isLoadingPoses,
            settingsTween: settings?.tween,
            isEnabled: isEnabled,
            hasPoses: hasPoses,
            isLoading: isLoading,
            shouldRender: shouldRender
          });
          
          if (shouldRender) {
            // If poses are still loading, show loading state
            if (isLoading && !hasPoses) {
              return (
                <Container>
                  <PixiLoader width={width} height={height} />
                  <Text
                    text="Loading poses..."
                    x={width / 2}
                    y={height / 2 + 100}
                    anchor={0.5}
                    style={{
                      fill: 0xffffff,
                      fontSize: 24,
                      fontWeight: "bold",
                      fontFamily: "Arial",
                      align: "center",
                    }}
                  />
                </Container>
              );
            }
            // If poses are loaded, render Tween component
            if (hasPoses) {
              return (
                <Tween
                  poses={poses}
                  duration={tweenDuration}
                  width={width}
                  height={height}
                  loop={tweenLoopCount}
                  ease={true}    
                  onComplete={handleNext}
                />
              );
            }
          }
        }
        return null;
      })()}

      {/* Pose-matching */}
      {state.value === 'poseMatching' && !isLoadingPoses && poses.length > 0 && settings?.poseMatching !== false && (
        <ConjecturePoseContainter
          width={width}
          height={height}
          columnDimensions={columnDimensions}
          rowDimensions={rowDimensions}
          poseData={poseData}
          mainCallback={backCallback}
          UUID={UUID}
          poses={poses}
          tolerances={tolerances}
          onCompleteCallback={handleNext}
          gameID={gameID}
          // NEW: enable single-match-per-logical-pose behavior and pass repetitions
          singleMatchPerPose={true}
          repetitions={repetitionCount}
        />
      )}

      {/* Intuition / Insight */}
      {(() => {
        if (state.value === 'intuition') {
          const shouldRender = conjectureData && settings?.intuition !== false;
          console.log('[LevelPlay] Intuition render check:', {
            state: state.value,
            hasConjectureData: !!conjectureData,
            settingsIntuition: settings?.intuition,
            shouldRender: shouldRender
          });
          if (shouldRender) {
            return (
              <ExperimentalTask
                width={width}
                height={height}
                prompt={expText}
                columnDimensions={columnDimensions}
                rowDimensions={rowDimensions}
                poseData={poseData}
                UUID={UUID}
                onComplete={handleNext}
                cursorTimer={debugMode ? 1000 : 10000}
                gameID={gameID}
                stageType="intuition"
                question={(() => {
                  const textBoxes = conjectureData[UUID]['Text Boxes'];
                  return textBoxes['Conjecture Statement'] || textBoxes['Intuition Description'] || textBoxes['Conjecture Description'] || '';
                })()}
                correctAnswer={(() => {
                  const textBoxes = conjectureData[UUID]['Text Boxes'];
                  const answer = textBoxes['Intuition Correct Answer'];
                  return answer === 'TRUE' || answer === 'FALSE' ? answer : null;
                })()}
              />
            );
          }
        }
        return null;
      })()}
      {state.value === 'insight' && settings?.insight !== false && (
        <ExperimentalTask
          width={width}
          height={height}
          prompt={expText}
          columnDimensions={columnDimensions}
          rowDimensions={rowDimensions}
          poseData={poseData}
          UUID={UUID}
          onComplete={handleNext}
          stageType="insight"
          cursorTimer={debugMode ? 1000 : 15000}
          gameID={gameID}
        />
      )}
      {/* Uncomment when mcq state is added */}
      {/* {state.value === 'mcq' && (
        <mcq
          width={width}
          height={height}
          question={}
          answerChoices={}
          columnDimensions={columnDimensions}
          rowDimensions={rowDimensions}
          poseData={poseData}
          UUID={UUID}
          onComplete={() => send('NEXT')}
          pressDelay={3000ms}
          gameID={gameID}
        />
      )} */}
      {(() => {
        if (state.value === 'mcq') {
          const shouldRender = settings?.multipleChoice !== false;
          const hasConjectureData = !!conjectureData;
          const textBoxes = conjectureData?.[UUID]?.['Text Boxes'];
          const hasQuestion = !!(textBoxes?.['Conjecture Statement'] || textBoxes?.['MCQ Question']);
          console.log('[LevelPlay] MCQ render check:', {
            state: state.value,
            settingsMultipleChoice: settings?.multipleChoice,
            hasConjectureData: hasConjectureData,
            hasQuestion: hasQuestion,
            shouldRender: shouldRender
          });
          if (shouldRender) {
            return (
              <NewStage  
                width={width}
                height={height}
                onComplete={handleNext}
                gameID={gameID}
                poseData={poseData}
                columnDimensions={columnDimensions}
                question={(() => {
                  const textBoxes = conjectureData?.[UUID]?.['Text Boxes'];
                  return textBoxes?.['Conjecture Statement'] || textBoxes?.['MCQ Question'] || '';
                })()}
                mcqChoices={(() => {
                  const textBoxes = conjectureData?.[UUID]?.['Text Boxes'];
                  return {
                    A: textBoxes?.['Multiple Choice 1'] || 'Choice A',
                    B: textBoxes?.['Multiple Choice 2'] || 'Choice B',
                    C: textBoxes?.['Multiple Choice 3'] || 'Choice C',
                    D: textBoxes?.['Multiple Choice 4'] || 'Choice D',
                  };
                })()}
                correctAnswer={(() => {
                  const textBoxes = conjectureData?.[UUID]?.['Text Boxes'];
                  return textBoxes?.['Correct Answer'] || 'A';
                })()}
              />
            );
          }
        }
        return null;
      })()}

      {/* Outro dialogue */}
      {state.value === 'outroDialogue' && conjectureData && settings?.story && (
        <Chapter
          key={`outro-${UUID}`}
          poseData={poseData}
          columnDimensions={columnDimensions}
          rowDimensions={rowDimensions}
          width={width}
          height={height}
          chapterConjecture={conjectureData[UUID]}
          currentConjectureIdx={currentConjectureIdx}
         nextChapterCallback={async () => {
          // Download all videos before level completion
          if (videoRecorderRef.current?.downloadAllVideos) {
            try {
              await videoRecorderRef.current.downloadAllVideos();
            } catch (error) {
              console.error('Error downloading videos:', error);
            }
          }
          // tell parent to advance the level...
          onLevelComplete();
        }}          isOutro={true}
        />
      )}

      {/* Fallback: Show BACK button if game is stuck (no component to render) */}
      {(() => {
        if (!settings) return null;
        
        // Check if current state has a component to render or is loading data
        const isTweenLoading = state.value === 'tween' && settings.tween !== false && isLoadingPoses && poses.length === 0;
        const isPoseMatchingLoading = state.value === 'poseMatching' && settings.poseMatching !== false && isLoadingPoses && poses.length === 0;
        const isIntuitionLoading = state.value === 'intuition' && settings.intuition !== false && !conjectureData;
        
        const hasComponentToRender = 
          (state.value === 'tween' && settings.tween !== false && (poses.length > 0 || isLoadingPoses)) ||
          (state.value === 'poseMatching' && settings.poseMatching !== false && poses.length > 0 && !isLoadingPoses) ||
          (state.value === 'intuition' && settings.intuition !== false && conjectureData) ||
          (state.value === 'insight' && settings.insight !== false) ||
          (state.value === 'mcq' && settings.multipleChoice !== false) ||
          (state.value === 'introDialogue' && !hasShownIntroResult && conjectureData && settings.story === true) ||
          (state.value === 'outroDialogue' && conjectureData && settings.story === true) ||
          state.value === 'levelEnd';
        
        // Don't show BACK button if data is still loading
        const isDataLoading = isTweenLoading || isPoseMatchingLoading || isIntuitionLoading;
        
        // If no component to render and not in introDialogue (waiting for data), and data is not loading, show BACK button
        if (!hasComponentToRender && !isDataLoading && state.value !== 'introDialogue' && conjectureData) {
          console.log('[LevelPlay] No component to render, showing fallback BACK button. State:', state.value, {
            isTweenLoading,
            isPoseMatchingLoading,
            isIntuitionLoading,
            hasComponentToRender
          });
          return (
            <Button
              width={width * 0.20}
              x={width * 0.5}
              y={height * 0.5}
              color={red}
              fontSize={width * 0.02}
              fontColor={white}
              text={"BACK"}
              fontWeight={800}
              callback={backCallback}
            />
          );
        }
        return null;
      })()}
    </>
  );
}
