import Background from "../Background";
import { Graphics, Text, Container } from "@inlet/react-pixi";
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
  const [repetitions, setRepetitions] = useState(3); // Default value
  
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

  // Get pose data from local storage
  useEffect(() => {
    const startPoseStr = localStorage.getItem("start.json");
    const intermediatePoseStr = localStorage.getItem("intermediate.json");
    const endPoseStr = localStorage.getItem("end.json");

    if (startPoseStr && intermediatePoseStr && endPoseStr) {
      try {
        const startPose = JSON.parse(startPoseStr);
        const intermediatePose = JSON.parse(intermediatePoseStr);
        const endPose = JSON.parse(endPoseStr);

        const startTolerance = parseInt(localStorage.getItem("Start Tolerance")) || 45;
        const intermediateTolerance = parseInt(localStorage.getItem("Intermediate Tolerance")) || 45;
        const endTolerance = parseInt(localStorage.getItem("End Tolerance")) || 45;

        if (startPose && intermediatePose && endPose) {
          setPoses([startPose, intermediatePose, endPose]);
          setTolerances([startTolerance, intermediateTolerance, endTolerance]);
        }
      } catch (e) {
        console.error("Failed to parse pose data from localStorage:", e);
      }
    }
  }, []);

  // create grouped array: [pose1,pose1,pose1, pose2,pose2,pose2, ...]
  const posesToMatchGrouped = poses || [];

return(
  <> 
  {/* If poses is not null then start pose matching to test */}
      {poses != null && (
        <Container>
          <Graphics draw={drawModalBackground} />
          <PoseMatchingSimplified
            poseData={poseData}
            posesToMatch={posesToMatchGrouped}
            columnDimensions={columnDimensions}
            onComplete={conjectureCallback}
            gameID={gameID}
            UUID={testUUID}
            tolerances={tolerances}
            singleMatchPerPose={true}
            repetitions={repetitions}
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
            text={"BACK"}
            fontWeight={800}
            callback={conjectureCallback}
          />
        </Container>
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