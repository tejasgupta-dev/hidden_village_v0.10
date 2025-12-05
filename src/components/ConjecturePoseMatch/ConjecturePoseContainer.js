import ConjecturePoseMatch from './ConjecturePoseMatch';
import Background from "../Background";
import { Graphics } from "@inlet/react-pixi";
import { darkGray, yellow } from "../../utils/colors";
import React, { useCallback, useState, useEffect } from "react";
import { 
  initializeSession, 
  bufferPoseDataWithAutoFlush, 
  startSmartAutoFlush, 
  stopAutoFlush, 
  endSession,
  getCurrentOrgContext
} from "../../firebase/database.js";
import { getUserSettings } from "../../firebase/userSettings.js";

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
        gameID
    } = props;

    const [repetitions, setRepetitions] = useState(3); // Default value

    // Load repetitions from user settings
    useEffect(() => {
        const loadRepetitions = async () => {
            try {
                const settings = await getUserSettings();
                if (settings && settings.repetitions) {
                    setRepetitions(Math.max(1, parseInt(settings.repetitions, 10) || 3));
                }
            } catch (e) {
                console.error("Failed to load repetitions settings, using default:", e);
            }
        };
        loadRepetitions();
    }, []);

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

    useEffect(() => {
        const isRecording = "true";
        
        if (isRecording === "true") {
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
              const { orgId } = await getCurrentOrgContext();
              bufferPoseDataWithAutoFlush(poseData, gameID, UUID, fps, orgId);
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
    }, [gameID, UUID, poseData]); // Added poseData to dependencies

    // Group poses according to repetitions setting: [pose1,pose1,pose1, pose2,pose2,pose2, ...]
    const posesGrouped = poses ? poses.flatMap((p) => Array(repetitions).fill(p)) : null;

    // Use background and graphics to draw background and then initiate conjecturePoseMatch
    return (
        <>
            <Background height={height * 1.1} width={width} />
            <Graphics draw={drawModalBackground} />
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
            />
        </>
    );
};

export default ConjecturePoseContainer;