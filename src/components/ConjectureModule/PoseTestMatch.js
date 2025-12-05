import Background from "../Background";
import { Graphics, Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { orange, black, white, darkGray, yellow, red, blue } from "../../utils/colors";
import Button from "../Button";
import RectButton from "../RectButton";
import { useCallback } from "react";
import React, { useState, useEffect } from 'react';
import PoseMatchingSimplified from "../PoseMatching";
import { 
  initializeSession, 
  bufferPoseDataWithAutoFlush, 
  startSmartAutoFlush, 
  stopAutoFlush, 
  endSession,
  getCurrentOrgContext
} from "../../firebase/database.js";
import { getUserSettings } from "../../firebase/userSettings.js";


const PoseTestMatch = (props) => {
  const { height, width, columnDimensions, conjectureCallback, poseData, gameID, UUID} = props;
  const [poses, setPoses] = useState(null);
  const [tolerances, setTolerances] = useState([]);
  
  // Generate a test UUID if not provided (for pose testing mode)
  const testUUID = UUID || 'pose-test-session';

  // Background for Pose Matching
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
  }, [width, height, columnDimensions]);

  // Get pose data from local storage
  useEffect(() => {
    const startPose = JSON.parse(localStorage.getItem("start.json"));
    const intermediatePose = JSON.parse(localStorage.getItem("intermediate.json"));
    const endPose = JSON.parse(localStorage.getItem("end.json"));

    const startTolerance = parseInt(localStorage.getItem("Start Tolerance")) || 45;
    const intermediateTolerance = parseInt(localStorage.getItem("Intermediate Tolerance")) || 45;
    const endTolerance = parseInt(localStorage.getItem("End Tolerance")) || 45;

    if (startPose && intermediatePose && endPose) {
      setPoses([startPose, intermediatePose, endPose]);
      setTolerances([startTolerance, intermediateTolerance, endTolerance]);
    }
  }, []);

  // Initialize pose data session when poses are loaded and gameID is available
  useEffect(() => {
    if (!poses || !gameID) return; // Wait for poses and gameID to be available
    
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
        if (!orgId) {
          console.warn('No orgId available, skipping pose data session initialization');
          return;
        }
        await initializeSession(gameID, fps, testUUID, orgId);
        
        // Start auto-flush with hybrid strategy
        autoFlushId = startSmartAutoFlush(gameID, testUUID, orgId, {
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
        
        // Create interval to buffer pose data
        const intervalId = setInterval(async () => {
          // Buffer the pose data
          const { orgId } = await getCurrentOrgContext();
          if (orgId && poseData) {
            bufferPoseDataWithAutoFlush(poseData, gameID, testUUID, fps, orgId);
          }
        }, 1000 / fps);
        
        // Return cleanup function
        return async () => {
          // Stop the data collection interval
          clearInterval(intervalId);
          
          // Stop auto-flush
          if (autoFlushId) {
            stopAutoFlush(autoFlushId);
          }
          
          // End session
          const { orgId } = await getCurrentOrgContext();
          if (orgId) {
            await endSession(gameID, testUUID, fps, orgId);
          }
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
  }, [poses, gameID, testUUID, poseData]); // Dependencies: re-initialize if poses, gameID, or UUID changes

  // create grouped array: [pose1,pose1,pose1, pose2,pose2,pose2, ...]
  const posesToMatchGrouped = (poses || []).flatMap((p) => [p, p, p]);

return(
  <> 
  {/* If poses is not null then start pose matching to test */}
      {poses != null && (
        <Graphics draw={drawModalBackground} >
        <>
        <PoseMatchingSimplified
          poseData={poseData}
          posesToMatch={posesToMatchGrouped}
          columnDimensions={columnDimensions}
          onComplete={conjectureCallback}
          gameID={gameID}
          UUID={testUUID}
          tolerances={tolerances}
          singleMatchPerPose={true}
        />
        {/* Back Button */}
        <RectButton
          height={height * 0.23}
          width={width * 0.26}
          x={width * 0.025}
          y={height * 0.85}
          color={black}
          fontSize={width * 0.015}
          fontColor={white}
          text={"BACK BUTTON"}
          fontWeight={800}
          callback={conjectureCallback}
        />
        </>
        </Graphics>
        
      )}
      {/* Otherwise, prompt to go back and complete all poses */}
      {poses == null &&
      <>
      <Text
        text={`EMPTY POSES\nPlease Complete All Poses`}
        x={width * 0.5}
        y={height * 0.15}
        style={
          new TextStyle({
            align: "center",
            fontSize: 40,
            fontWeight: 800,
            fill: [blue],
            letterSpacing: 0,
          })
        }
        anchor={0.5}
      />
      <Button
        width={width*0.2}
        x={width*0.5}
        y={height*0.5}
        color={red}
        fontSize={width*0.05}
        fontColor={white}
        text={"BACK"}
        fontWeight={800}
        callback={conjectureCallback}
        />
        </>
      }

      

      

  </>
  );



};

export default PoseTestMatch;