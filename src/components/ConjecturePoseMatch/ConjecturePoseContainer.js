import ConjecturePoseMatch from './ConjecturePoseMatch';
import Background from "../Background";
import { Graphics } from "@inlet/react-pixi";
import { darkGray, yellow } from "../../utils/colors";
import React, { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { 
  initializeSession, 
  bufferPoseDataWithAutoFlush, 
  startSmartAutoFlush, 
  stopAutoFlush, 
  endSession,
  getCurrentOrgContext
} from "../../firebase/database.js";
import { getUserSettings } from '../../firebase/userSettings';
import { settings } from 'pixi.js';


const ConjecturePoseContainer = (props) => {
    const {
        poses,
        tolerances, 
        needBack,
        height,
        width,
        columnDimensions,
        rowDimensions,
        editCallback,
        mainCallback,
        poseData,
        UUID,
        onCompleteCallback,
        gameID,
        repetitions: repetitionsProp, // forwardable prop
    } = props;

    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
        console.debug('[ConjecturePoseContainer] Component rendered with props:', {
            'poses': poses ? `Array(${poses.length})` : poses,
            'poses.length': poses?.length,
            'tolerances': tolerances,
            'UUID': UUID,
            'gameID': gameID,
            'repetitionsProp': repetitionsProp,
            'poseData exists': !!poseData
        });
    }

    const [repetitionsState, setRepetitionsState] = useState(3); // Default value

    // Use prop if provided, otherwise use state
    const repetitions = repetitionsProp !== undefined ? repetitionsProp : repetitionsState;

    // Use ref to store latest poseData to avoid re-creating useEffect on every frame
    const poseDataRef = useRef(poseData);
    useEffect(() => {
        poseDataRef.current = poseData;
    }, [poseData]);

    // Load repetitions from user settings (only if not provided as prop)
    useEffect(() => {
        if (repetitionsProp !== undefined) {
            // If prop is provided, don't load from settings
            return;
        }
        
        const loadRepetitions = async () => {
            try {
                const settings = await getUserSettings();
                if (settings && settings.repetitions) {
                    setRepetitionsState(Math.max(1, parseInt(settings.repetitions, 10) || 3));
                }
            } catch (e) {
                console.error("Failed to load repetitions settings, using default:", e);
            }
        };
        loadRepetitions();
    }, [repetitionsProp]);

    const drawModalBackground = useCallback((g) => {
        g.beginFill(darkGray, 0.9);
        g.drawRect(0, 0, width, height);
        g.endFill();
        const col1 = columnDimensions(1);
        g.beginFill(yellow, 1);
        g.drawRect(col1.x, col1.y, col1.width, col1.height);
        const col3 = columnDimensions(3);
        g.drawRect(col3.x, col3.y, col3.width, col3.height);
        g.endFill();
    }, [columnDimensions, width, height]);

    // **Need to test this still**
    // Load settings when component mounts
      // useEffect(() => {
      //   const loadSettings = async () => {
      //     const userSettings = await getUserSettings();
      //   };
      //   loadSettings();
      // }, []);

    useEffect(() => {
        const isRecording = "true";
        
        if (isRecording === "true") {
          // FRAMERATE CAN BE CHANGED HERE
          let autoFlushId;
          let frameRate = 12; // Default value
          
          // Load FPS from user settings
          const loadFrameRate = async () => {
            try {
              const settings = await getUserSettings();
              if (settings && settings.fps) {
                frameRate = Math.max(1, Math.min(30, parseInt(settings.fps, 10) || 12));
              }
            } catch (e) {
              console.error("Failed to load FPS settings, using default:", e);
            }
            return frameRate;
          };
          
          // Initialize session with static data once
          const setupSession = async (fps) => {
            const { orgId } = await getCurrentOrgContext();
            await initializeSession(gameID, fps, UUID, orgId);
            
            // Start auto-flush with hybrid strategy - now passes UUID and orgId
            autoFlushId = startSmartAutoFlush(gameID, UUID, orgId, {
              maxBufferSize: 100,      
              flushIntervalMs: 7500,  
              minBufferSize: 10,       
              frameRate: fps    
            });
          };

          // Initialize the session and wait for it to complete
          const initializeAndStart = async () => {
            const fps = await loadFrameRate();
            await setupSession(fps);
            
            // Create interval to buffer pose data (much lighter than before)
            const intervalId = setInterval(async () => {
              // Buffer the pose data - now passes UUID, frameRate, and orgId
              // Use ref to get latest poseData without causing re-renders
              const { orgId } = await getCurrentOrgContext();
              bufferPoseDataWithAutoFlush(poseDataRef.current, gameID, UUID, fps, orgId);
            }, 1000 / fps);
            
            // Return cleanup function
            return async () => {
              // Stop the data collection interval
              clearInterval(intervalId);
              
              // Stop auto-flush
              if (autoFlushId) {
                stopAutoFlush(autoFlushId);
              }
              
              // End session - now passes UUID, frameRate, and orgId
              const { orgId } = await getCurrentOrgContext();
              await endSession(gameID, UUID, fps, orgId);
            };
          };

          // Start the initialization and get cleanup function
          let cleanupFunction;
          initializeAndStart().then(cleanup => {
            cleanupFunction = cleanup;
          });
          
          // Return cleanup function for useEffect
          return async () => {
            if (cleanupFunction) {
              await cleanupFunction();
            }
          };
        } 
    }, [gameID, UUID]); // Removed poseData from dependencies - using ref instead to avoid re-renders

    // Group poses according to repetitions setting: [pose1, pose2, pose3, pose1, pose2, pose3, ...]
    // Memoize to prevent infinite re-renders
    const posesGrouped = useMemo(() => {
      return poses && poses.length > 0 && repetitions > 0 
        ? Array(repetitions).fill(null).flatMap(() => poses) 
        : null;
    }, [poses, repetitions]);
    
    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
        console.debug('[ConjecturePoseContainer] Poses grouping:', {
            'poses exists': !!poses,
            'poses.length': poses?.length,
            'repetitions': repetitions,
            'posesGrouped exists': !!posesGrouped,
            'posesGrouped.length': posesGrouped?.length,
            'will render ConjecturePoseMatch': !!(posesGrouped && posesGrouped.length > 0)
        });
    }

    // Use background and graphics to draw background and then initiate conjecturePoseMatch
    return (
        <>
            <Background height={height * 1.1} width={width} />
            <Graphics draw={drawModalBackground} />
            {posesGrouped && posesGrouped.length > 0 ? (
                <ConjecturePoseMatch
                    poses={posesGrouped}
                    tolerances={tolerances}
                    height={height}
                    width={width}
                    columnDimensions={columnDimensions}
                    rowDimensions={rowDimensions}
                    editCallback={editCallback}
                    mainCallback={mainCallback}
                    poseData={poseData}
                    UUID={UUID}
                    onCompleteCallback={onCompleteCallback}
                    needBack={needBack}
                    gameID={gameID}
                    repetitions={repetitions}
                />
            ) : null}
        </>
    );
};

export default ConjecturePoseContainer;