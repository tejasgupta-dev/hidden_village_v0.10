import Background from "../Background";
import { Graphics, Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { orange, black, white, darkGray, yellow } from "../../utils/colors";
import Button from "../Button";
import RectButton from "../RectButton";
import { getConjectureDataByUUIDWithCurrentOrg } from "../../firebase/database";
import { useCallback } from "react";
import React, { useState, useEffect } from 'react';
import { Container } from "postcss";
import { set } from "firebase/database";
import PoseMatchingSimplified from "../PoseMatching";

const ConjecturePoseMatch = (props) => {
  const { poses, tolerances, width, columnDimensions, onCompleteCallback, poseData, UUID, gameID} = props;


return(
  <>
      {poses != null && (
        <>
        <PoseMatchingSimplified
          poseData={poseData}
          tolerances={tolerances}
          UUID = {UUID}
          posesToMatch={poses}
          columnDimensions={columnDimensions}
          onComplete={onCompleteCallback}
          gameID={gameID}
          singleMatchPerPose={false}
        />
        </>
      )}
  </>
  );
};

export default ConjecturePoseMatch;