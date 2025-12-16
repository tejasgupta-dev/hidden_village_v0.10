import Background from "../Background";
import { Graphics, Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { orange, black, white, darkGray, yellow } from "../../utils/colors";
import Button from "../Button";
import RectButton from "../RectButton";
import { getConjectureDataByUUIDWithCurrentOrg } from "../../firebase/database";
import { useCallback } from "react";
import React, { useState, useEffect } from 'react';
import { set } from "firebase/database";
import PoseMatchingSimplified from "../PoseMatching";


const ConjecturePoseMatch = (props) => {
  const {
    poses,
    tolerances,
    width,
    columnDimensions,
    onCompleteCallback,
    poseData,
    UUID,
    gameID,
    singleMatchPerPose = true,
    repetitions = 3
  } = props;

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.debug('[ConjecturePoseMatch] Component rendered with props:', {
      'poses': poses ? `Array(${poses.length})` : poses,
      'poses.length': poses?.length,
      'tolerances': tolerances,
      'UUID': UUID,
      'gameID': gameID,
      'singleMatchPerPose': singleMatchPerPose,
      'repetitions': repetitions
    });
  }

  // Only render if poses is not null/undefined and has length > 0
  if (!poses || poses.length === 0) {
    console.warn('[ConjecturePoseMatch] Returning null - poses check failed:', {
      'poses is null/undefined': !poses,
      'poses.length': poses?.length,
      'poses value': poses
    });
    return null;
  }
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.debug('[ConjecturePoseMatch] Rendering PoseMatchingSimplified with', poses.length, 'poses');
  }

  return (
    <>
      <PoseMatchingSimplified
        poseData={poseData}
        tolerances={tolerances}
        UUID={UUID}
        posesToMatch={poses}
        columnDimensions={columnDimensions}
        onComplete={onCompleteCallback}
        gameID={gameID}
        singleMatchPerPose={singleMatchPerPose}
        repetitions={repetitions}
      />
    </>
  );
};

export default ConjecturePoseMatch;