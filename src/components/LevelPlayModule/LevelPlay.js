import { useMachine } from '@xstate/react';
import React, { useState, useEffect, useCallback, useRef } from 'react';

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
  React.useEffect(() => {
    send("RESET_CONTEXT");
  }, [currentConjectureIdx, send]);
  const [conjectureData, setConjectureData] = useState(null);
  const [poses, setPoses] = useState([]);
  const [tolerances, setTolerances] = useState([]);
  const [expText, setExpText] = useState('');
  const [settings, setSettings] = useState(null);
  const prevStateRef = React.useRef('introDialogue');
  const videoRecorderRef = useRef(null);
  const tweenDuration = 2000;
  const tweenLoopCount = settings?.repetitions ?? 2;

  // Memoize onComplete callback to prevent timer resets in child components
  const handleNext = useCallback(() => {
    send('NEXT');
  }, [send]);

  /* ---------- load conjecture data ---------- */
  useEffect(() => {
    getConjectureDataByUUIDWithCurrentOrg(UUID)
      .then((d) => {
        setConjectureData(d);

        const { ['Start Pose']: s, ['Intermediate Pose']: i, ['End Pose']: e } = d[UUID];

        setPoses([
          JSON.parse(s.poseData),
          JSON.parse(i.poseData),
          JSON.parse(e.poseData),
        ]);

        const tolArray = [s, i, e].map((pose) =>
          typeof pose.tolerance === 'string' || typeof pose.tolerance === 'number'
            ? parseInt(pose.tolerance)
            : null
        );
        setTolerances(tolArray);
      })
      .catch(console.error);
  }, [UUID]);

  /* ---------- phase event tracking ---------- */
  useEffect(() => {
    if (!gameID) return;

    if (state.value === 'tween') {
      writeToDatabaseTweenStart(gameID).catch(console.error);
    } else if (state.value === 'poseMatching') {
      writeToDatabasePoseMatchingStart(gameID).catch(console.error);
    } else if (state.value === 'intuition' && conjectureData) {
      const textBoxes = conjectureData[UUID]['Text Boxes'];
      const desc = textBoxes['Intuition Description'] || textBoxes['Conjecture Description'] || '';
      writeToDatabaseIntuitionStart(gameID, desc).catch(console.error);
    } else if (state.value === 'mcq' && conjectureData) {
      const question = conjectureData[UUID]['Text Boxes']['MCQ Question'] || '';
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
      writeToDatabaseTweenEnd(gameID).catch(console.error);
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
    // Use Intuition Description if available, fallback to Conjecture Description for backward compatibility
    const desc = textBoxes['Intuition Description'] || textBoxes['Conjecture Description'] || '';

    if (state.value === 'intuition') {
      setExpText(`${desc}\nDo you think this is TRUE or FALSE?`);
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
    const loadSettings = async () => {
      const userSettings = await getUserSettings();
      setSettings(userSettings);
    };
    loadSettings();
  }, []);

  // If story is disabled, skip intro/outro so the game continues
  useEffect(() => {
    if (!settings) return;
    if (settings.story === false) {
      // If we're stuck at the intro, mark it shown and advance
      if (state.value === 'introDialogue') {
        try {
          markIntroShown(currentConjectureIdx);
        } catch (e) {
          // no-op if markIntroShown isn't available
        }
        send('NEXT');
      }
      // If we're at the outro, finish the level immediately
      if (state.value === 'outroDialogue') {
        // Обработать оставшиеся видео перед завершением
        if (videoRecorderRef.current?.downloadAllVideos) {
          videoRecorderRef.current.downloadAllVideos().catch(error => {
            console.error('Error processing videos:', error);
          });
        }
        onLevelComplete?.();
      }
    }
  }, [settings, state.value, currentConjectureIdx, markIntroShown, send, onLevelComplete]);

  // Skip disabled game modules automatically
  useEffect(() => {
    if (!settings) return;
    
    // Skip tween if disabled
    if (settings.tween === false && state.value === 'tween') {
      send('NEXT');
    }
    // Skip poseMatching if disabled
    else if (settings.poseMatching === false && state.value === 'poseMatching') {
      send('NEXT');
    }
    // Skip intuition if disabled
    else if (settings.intuition === false && state.value === 'intuition') {
      send('NEXT');
    }
    // Skip insight if disabled
    else if (settings.insight === false && state.value === 'insight') {
      send('NEXT');
    }
    // Skip multipleChoice if disabled
    else if (settings.multipleChoice === false && state.value === 'mcq') {
      send('NEXT');
    }
  }, [settings, state.value, send]);

  
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
        !hasShownIntro(currentConjectureIdx) &&
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
      {(['tween','poseMatching', 'intuition', 'insight'].includes(state.value)) && (
        <VideoRecorder 
          ref={videoRecorderRef}
          phase={state.value} 
          curricularID={UUID} 
          gameID={gameID} 
        />
      )}

      

      {/* Tween animation */}
      {state.value === 'tween' && poses.length > 0 && settings?.tween !== false && (
        <Tween
          poses={poses}
          duration={tweenDuration}
          width={width}
          height={height}
          loop={tweenLoopCount}
          ease={true}    
          onComplete={handleNext}
        />
      )}

      {/* Pose-matching */}
      {state.value === 'poseMatching' && poses.length > 0 && settings?.poseMatching !== false && (
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
        />
      )}

      {/* Intuition / Insight */}
      {state.value === 'intuition' && conjectureData && settings?.intuition !== false && (
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
            return textBoxes['Intuition Description'] || textBoxes['Conjecture Description'] || '';
          })()}
          correctAnswer={(() => {
            const textBoxes = conjectureData[UUID]['Text Boxes'];
            const answer = textBoxes['Intuition Correct Answer'];
            return answer === 'TRUE' || answer === 'FALSE' ? answer : null;
          })()}
        />
      )}
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
      {state.value === 'mcq' && conjectureData && settings?.multipleChoice !== false && (
        <NewStage  
          width={width}
          height={height}
          onComplete={handleNext}
          gameID={gameID}
          poseData={poseData}
          columnDimensions={columnDimensions}
          question={conjectureData[UUID]['Text Boxes']['MCQ Question'] || 'What is the answer?'}
          mcqChoices={{
            A: conjectureData[UUID]['Text Boxes']['Multiple Choice 1'] || 'Choice A',
            B: conjectureData[UUID]['Text Boxes']['Multiple Choice 2'] || 'Choice B',
            C: conjectureData[UUID]['Text Boxes']['Multiple Choice 3'] || 'Choice C',
            D: conjectureData[UUID]['Text Boxes']['Multiple Choice 4'] || 'Choice D',
          }}
          correctAnswer={conjectureData[UUID]['Text Boxes']['Correct Answer'] || 'A'}
        />
      )}

      {/* Outro dialogue */}
      {state.value === 'outroDialogue' && conjectureData && (
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
          // Скачать все видео перед завершением уровня
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
    </>
  );
}
