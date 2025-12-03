import { useMachine } from '@xstate/react';
import React, { useState, useEffect, useCallback } from 'react';

import VideoRecorder from '../VideoRecorder';
import Chapter from '../Chapter';
import ConjecturePoseContainter from '../ConjecturePoseMatch/ConjecturePoseContainer';
import ExperimentalTask from '../ExperimentalTask';
import Tween from '../Tween';
import LevelPlayMachine from './LevelPlayMachine';
import {
  getConjectureDataByUUIDWithCurrentOrg,
  writeToDatabaseIntuitionStart,
  writeToDatabaseIntuitionEnd,
} from '../../firebase/database';
import NewStage from '../NewStage';
import { getUserSettings } from '../../firebase/userSettings';

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
  const [repetitionCountFromDB, setRepetitionCountFromDB] = useState(null);
  // default repetitions fallback
  const repetitionCount = (repetitionCountFromDB && Number.isInteger(repetitionCountFromDB))
    ? Math.max(1, repetitionCountFromDB)
    : (settings && Number.isInteger(settings.repetitions) ? Math.max(1, settings.repetitions) : 3);
  const tweenDuration = 2000;
  const tweenLoopCount = 2;

  // Memoize onComplete callback to prevent timer resets in child components
  const handleNext = useCallback(() => {
    send('NEXT');
  }, [send]);

  /* ---------- load conjecture data ---------- */
  useEffect(() => {
    getConjectureDataByUUIDWithCurrentOrg(UUID)
      .then((d) => {
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

  /* ---------- experimental prompt ---------- */
  useEffect(() => {
    if (!conjectureData) return;
    const desc = conjectureData[UUID]['Text Boxes']['Conjecture Description'];

    if (state.value === 'intuition') {
      setExpText(`${desc}\nDo you think this is TRUE or FALSE?`);
      writeToDatabaseIntuitionStart(gameID).catch(console.error);
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

    // Skip story intro/outro when story setting is disabled
    if (settings.story === false) {
      if (state.value === 'introDialogue') {
        try {
          markIntroShown(currentConjectureIdx);
        } catch (e) {
          // no-op if markIntroShown isn't available
        }
        send('NEXT');
      }
      if (state.value === 'outroDialogue') {
        onLevelComplete?.();
      }
    }

    // Skip the tween animation when the tween setting is disabled
    // (advance to the next state immediately)
    if (settings.tween === false && state.value === 'tween') {
      send('NEXT');
    }

    // Skip the pose-matching module when the poseMatching setting is disabled
    if (settings.poseMatching === false && state.value === 'poseMatching') {
      send('NEXT');
    }

    // Skip the intuition module when the intuition setting is disabled
    if (settings.intuition === false && state.value === 'intuition') {
      send('NEXT');
    }

    // Skip the insight module when the insight setting is disabled
    if (settings.insight === false && state.value === 'insight') {
      send('NEXT');
    }

    // Skip the multiple choice module when the multipleChoice setting is disabled
    if (settings.multipleChoice === false && state.value === 'mcq') {
      send('NEXT');
    }
  }, [settings, state.value, currentConjectureIdx, markIntroShown, send, onLevelComplete]);
  
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
        <VideoRecorder phase={state.value} curricularID={UUID} gameID={gameID} />
      )}

      

      {/* Tween animation */}
      {state.value === 'tween' && poses.length > 0 && (
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
      {state.value === 'poseMatching' && poses.length > 0 && (
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
      {state.value === 'intuition' && (
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
        />
      )}
      {state.value === 'insight' && (
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
      {state.value === 'mcq' && (
        <NewStage  
          width={width}
          height={height}
          onComplete={handleNext}
          gameID={gameID}
          poseData={poseData}
          columnDimensions={columnDimensions}
          question="How many sides does a triangle have??"
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
         nextChapterCallback={() => {
          // tell parent to advance the level...
          onLevelComplete();
        }}          isOutro={true}
        />
      )}
    </>
  );
}
