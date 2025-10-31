import {
  matchSegmentToLandmarks,
  segmentSimilarity,
} from "./Pose/pose_drawing_utilities";
import { enrichLandmarks } from "./Pose/landmark_utilities";
import ErrorBoundary from "./utilities/ErrorBoundary.js";
import Pose from "./Pose/index.js";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Text, Container } from "@inlet/react-pixi";
import { white } from "../utils/colors";
import { writeToDatabasePoseMatch, writeToDatabasePoseStart } from "../firebase/database.js";

const MATCH_CONFIG = [
  {"segment": "RIGHT_BICEP", "data": "poseLandmarks"}, 
  {"segment": "RIGHT_FOREARM", "data": "poseLandmarks"},
  {"segment": "LEFT_BICEP", "data": "poseLandmarks"}, 
  {"segment": "LEFT_FOREARM", "data": "poseLandmarks"}
];

const DEFAULT_SIMILARITY_THRESHOLD = 45;
const TRANSITION_DELAY = 1000;

const PoseMatching = (props) => {
  // new prop `singleMatchPerPose` controls whether PoseMatching treats each group-of-3
  // as a single logical pose (true) or iterates every entry (false, original behavior).
  const {
    posesToMatch,
    tolerances,
    columnDimensions,
    onComplete,
    UUID,
    gameID,
    singleMatchPerPose = false,
  } = props;

  // state index semantics:
  // - singleMatchPerPose === false: currentPoseIndex is an index into posesToMatch (original)
  // - singleMatchPerPose === true: currentPoseIndex is the logical pose index (0..n-1)
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [text, setText] = useState(
    singleMatchPerPose
      ? `Match pose ${currentPoseIndex + 1} on the left!`
      : `Match pose ${Math.floor(currentPoseIndex / 3) + 1}.${currentPoseIndex % 3 + 1} on the left!`
  );
  const [poseSimilarity, setPoseSimilarity] = useState([]);
  
  // Memoized calculations
  const modelColumn = useMemo(() => columnDimensions(1), [columnDimensions]);
  const col2Dim = useMemo(() => columnDimensions(2), [columnDimensions]);
  const playerColumn = useMemo(() => columnDimensions(3), [columnDimensions]);
  
  const SUB_GROUP_SIZE = 3;
  const currentPose = useMemo(() => {
    if (singleMatchPerPose) {
      const srcIdx = currentPoseIndex * SUB_GROUP_SIZE;
      if (srcIdx >= posesToMatch.length) return {};
      return enrichLandmarks(posesToMatch[srcIdx]);
    } else {
      if (currentPoseIndex >= posesToMatch.length) return {};
      return enrichLandmarks(posesToMatch[currentPoseIndex]);
    }
  }, [posesToMatch, currentPoseIndex, singleMatchPerPose]);
  
  const poseMatchData = useMemo(() => {
    let srcIdx = currentPoseIndex;
    if (singleMatchPerPose) srcIdx = currentPoseIndex * SUB_GROUP_SIZE;
    if (srcIdx >= posesToMatch.length) return [];

    const currentPoseData = posesToMatch[srcIdx];
    return MATCH_CONFIG.map((config) => ({
      ...config,
      landmarks: matchSegmentToLandmarks(config, currentPoseData, modelColumn),
    }));
  }, [posesToMatch, currentPoseIndex, modelColumn, singleMatchPerPose]);
  
  const currentTolerance = useMemo(() => {
    if (!Array.isArray(tolerances)) return DEFAULT_SIMILARITY_THRESHOLD;
    if (singleMatchPerPose) {
      // tolerances expected per logical pose when using singleMatchPerPose
      if (
        currentPoseIndex < tolerances.length &&
        typeof tolerances[currentPoseIndex] === "number" &&
        !isNaN(tolerances[currentPoseIndex]) &&
        tolerances[currentPoseIndex] >= 0
      ) {
        return tolerances[currentPoseIndex];
      }
      return DEFAULT_SIMILARITY_THRESHOLD;
    } else {
      // legacy behavior: tolerance may be provided per-entry
      if (
        currentPoseIndex < tolerances.length &&
        typeof tolerances[currentPoseIndex] === "number" &&
        !isNaN(tolerances[currentPoseIndex]) &&
        tolerances[currentPoseIndex] >= 0
      ) {
        return tolerances[currentPoseIndex];
      }
      return DEFAULT_SIMILARITY_THRESHOLD;
    }
  }, [tolerances, currentPoseIndex, singleMatchPerPose]);

  // Initialize pose on mount
  useEffect(() => {
    if (posesToMatch.length > 0 && !isTransitioning && gameID) {
      console.log("Pose is starting...");
      if (singleMatchPerPose) {
        writeToDatabasePoseStart(`Pose ${currentPoseIndex + 1}`, UUID, gameID);
      } else {
        writeToDatabasePoseStart(
          `Pose ${Math.floor(currentPoseIndex / 3) + 1}-${currentPoseIndex % 3 + 1}`,
          UUID,
          gameID
        );
      }
    }
  }, [currentPoseIndex, isTransitioning, posesToMatch.length, UUID, gameID, singleMatchPerPose]);

  // Calculate pose similarity
  useEffect(() => {
    if (isTransitioning || !poseMatchData.length || !props.poseData.poseLandmarks) {
      setPoseSimilarity([{ similarityScore: 0 }]);
      return;
    }

    const convertedLandmarks = poseMatchData.map((segmentSet) => ({
      segment: segmentSet.segment,
      landmarks: matchSegmentToLandmarks(segmentSet, props.poseData, playerColumn),
    }));

    const similarityScores = poseMatchData.map((segmentSet) => {
      const playerSet = convertedLandmarks.find(
        (converted) => converted.segment === segmentSet.segment
      ).landmarks;
      const modelSet = segmentSet.landmarks;
      const similarityScore = segmentSimilarity(playerSet, modelSet);
      
      return { segment: segmentSet.segment, similarityScore };
    });
    
    setPoseSimilarity(similarityScores);
  }, [props.poseData, poseMatchData, playerColumn, isTransitioning]);

  // Handle pose matching logic
  const handlePoseMatch = useCallback(() => {
    if (gameID) {
      if (singleMatchPerPose) {
        writeToDatabasePoseMatch(`Pose ${currentPoseIndex + 1}`, gameID).catch(console.error);
      } else {
        writeToDatabasePoseMatch(
          `Pose ${Math.floor(currentPoseIndex / 3) + 1}-${currentPoseIndex % 3 + 1}`,
          gameID
        ).catch(console.error);
      }
    }

    setIsTransitioning(true);
    setText("Great!");

    setTimeout(() => {
      const nextIndex = currentPoseIndex + 1;

      // compute end condition for singleMatchPerPose vs legacy
      const limit = singleMatchPerPose
        ? Math.ceil(posesToMatch.length / SUB_GROUP_SIZE)
        : posesToMatch.length;

      if (nextIndex >= limit) {
        // All poses completed
        setIsTransitioning(false);
        onComplete();
      } else {
        // Move to next pose (semantic increment)
        setCurrentPoseIndex(nextIndex);
        setText(
          singleMatchPerPose
            ? `Match pose ${nextIndex + 1} on the left!`
            : `Match pose ${Math.floor(nextIndex / 3) + 1}.${nextIndex % 3 + 1} on the left!`
        );
        setIsTransitioning(false);
      }
    }, TRANSITION_DELAY);
  }, [currentPoseIndex, posesToMatch.length, gameID, onComplete, singleMatchPerPose]);
  
  // Check if pose matches threshold
  useEffect(() => {
    if (isTransitioning || poseSimilarity.length === 0) return;
    
    const allSegmentsMatch = poseSimilarity.every(
      (segment) => segment.similarityScore > currentTolerance
    );
    
    if (allSegmentsMatch) {
      console.log(`Pose ${currentPoseIndex + 1} matched with tolerance: ${currentTolerance}`);
      handlePoseMatch();
    }
  }, [poseSimilarity, currentTolerance, isTransitioning, handlePoseMatch, currentPoseIndex]);

  // Early return if no poses to match
  if (posesToMatch.length === 0) {
    return null;
  }

  return (
    <Container>
      <ErrorBoundary>
        <Pose poseData={currentPose} colAttr={modelColumn} />
        <Text
          text={text}
          y={col2Dim.height / 2}
          x={col2Dim.x + col2Dim.margin}
          style={
            new PIXI.TextStyle({
              align: "center",
              fontFamily: "Futura",
              fontSize: "4em",
              fontWeight: 800,
              fill: [white],
              wordWrap: true,
              wordWrapWidth: col2Dim.width,
            })
          }
        />
        <Pose
          poseData={props.poseData}
          colAttr={playerColumn}
          similarityScores={poseSimilarity}   
        />
      </ErrorBoundary>
    </Container>
  );
};

export default PoseMatching;