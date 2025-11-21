import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import * as PIXI from "pixi.js";
import { Graphics, Text, Sprite } from "@inlet/react-pixi";
import cursorIcon from '../assets/cursor.png';
import CursorMode from "./CursorMode.js";
import Pose from "./Pose/index";
import Background from "./Background";
import { white, darkGray, yellow } from "../utils/colors";
import { 
  bufferPoseDataWithAutoFlush,
  writeToDatabaseTFAnswer,
  writeToDatabaseMCAnswer 
} from "../firebase/database.js";
import { Rectangle } from "@pixi/math";

/** Safe Firebase write error handler */
const handleWriteError = (error) => {
  console.error("Failed to write pose data:", error);
};

const ExperimentalTask = (props) => {
  const {
    prompt,
    poseData,
    UUID,
    columnDimensions,
    onComplete,
    rowDimensions,
    cursorTimer,
    gameID,
    stageType, 
    height,
    width,
  } = props;

  const isIntuition = stageType === "intuition";
  const isInsight = stageType === "insight";

  const [showCursor, setShowCursor] = useState(false);
  const cursorTimerRef = useRef(null);

  // Yellow background for intuition stage
  const drawModalBackground = useCallback(
    (g) => {
      g.beginFill(yellow, 0.9);
      g.drawRect(0, 0, window.innerWidth, window.innerHeight);
      g.endFill();
    },
    [columnDimensions]
  );

  // Gray background for insight stage
  const drawGrayBackground = useCallback(
    (g) => {
      g.beginFill(darkGray, 0.9);
      g.drawRect(0, 0, window.innerWidth, window.innerHeight);
      const col3 = columnDimensions(3);
      g.endFill();
      g.beginFill(yellow, 1);
      g.drawRect(col3.x, col3.y, col3.width, col3.height);
      g.endFill();
    },
    [columnDimensions]
  );

  // ---------- INTUITION STAGE ----------
  if (isIntuition) {
    const [hoveredBox, setHoveredBox] = useState(null);
    const [hoverTime, setHoverTime] = useState(0);
    const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
    const hoverTimerRef = useRef(null);
    const autoTimerRef = useRef(null);
    const onCompleteRef = useRef(onComplete);
  
    const leftCol  = columnDimensions(1);
    const rightCol = columnDimensions(3);
    
    // Compute centered boxes around middle of screen (smaller than full column)
    const BOX_WIDTH = 400;
    const BOX_HEIGHT = 440;
    const centerY = window.innerHeight / 2;
    
    const trueBox = useMemo(() => ({
      x: leftCol.x + (leftCol.width - BOX_WIDTH) / 2,
      y: centerY - BOX_HEIGHT / 2,
      width: BOX_WIDTH,
      height: BOX_HEIGHT,
    }), [leftCol, centerY]);
    
    const falseBox = useMemo(() => ({
      x: rightCol.x + (rightCol.width - BOX_WIDTH) / 2,
      y: centerY - BOX_HEIGHT / 2,
      width: BOX_WIDTH,
      height: BOX_HEIGHT,
    }), [rightCol, centerY]);
    
    const rectsOverlap = (a, b) => !(
      a.x + a.width < b.x ||
      a.x > b.x + b.width ||
      a.y + a.height < b.y ||
      a.y > b.y + b.height
    );

    // Keep onComplete ref up to date
    useEffect(() => {
      onCompleteRef.current = onComplete;
    }, [onComplete]);

    // 10-second auto-timer
    useEffect(() => {
      autoTimerRef.current = setTimeout(() => {
        console.log("Intuition: Calling onComplete from 10-second auto-timer");
        // Clear hover timer if it exists
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        onCompleteRef.current();
      }, 10000);
      
      return () => {
        if (autoTimerRef.current) {
          clearTimeout(autoTimerRef.current);
          autoTimerRef.current = null;
        }
      };
    }, []);
  
    useEffect(() => {
      const rightTip = poseData?.rightHandLandmarks?.[8];
      const leftTip  = poseData?.leftHandLandmarks?.[8];
      const lm = leftTip || rightTip;
      if (!lm) return;
  
      // normalized → pixel
      const pos = {
        x: lm.x * window.innerWidth,
        y: lm.y * window.innerHeight,
      };
      setCursorPos(pos);
  
      const hitAreas = {
        left: new Rectangle(trueBox.x, trueBox.y, trueBox.width, trueBox.height),
        right: new Rectangle(falseBox.x, falseBox.y, falseBox.width, falseBox.height),
      };
  
      const cursorRadius = 20;
      const cursorArea = new Rectangle(pos.x - cursorRadius, pos.y - cursorRadius, cursorRadius * 2, cursorRadius * 2);
  
      let next = null;
      for (const [name, box] of Object.entries(hitAreas)) {
        if (rectsOverlap(cursorArea, box)) {
          next = name;
          break;
        }
      }
  
      if (next !== hoveredBox) {
        setHoveredBox(next);
        setHoverTime(0);
      }
    }, [poseData, columnDimensions, hoveredBox, trueBox, falseBox]);

    // Hover dwell timer (2 seconds)
    useEffect(() => {
      if (!hoveredBox) {
        setHoverTime(0);
        return;
      }
  
      // Start 2-second timer on stable hover
      hoverTimerRef.current && clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        console.log("Intuition: Calling onComplete after stable 2s hover");
        // Clear auto timer if it exists
        if (autoTimerRef.current) {
          clearTimeout(autoTimerRef.current);
          autoTimerRef.current = null;
        }
        onCompleteRef.current();
      }, 2000);
      
      // Update hover time for visual feedback
      const tick = setInterval(() => setHoverTime((t) => Math.min(2, t + 0.1)), 100);
  
      return () => {
        clearTimeout(hoverTimerRef.current);
        clearInterval(tick);
        hoverTimerRef.current = null;
        setHoverTime(0);
      };
    }, [hoveredBox]);


    return (
      <>
        <Graphics draw={drawModalBackground} />
        <Background height={height} width={width} />
        <Text
          text={prompt}
          y={50}
          x={window.innerWidth / 2}
          anchor={0.5}
          style={
            new PIXI.TextStyle({
              align: "center",
              fontFamily: "Futura",
              fontSize: "3.5em",
              fontWeight: 800,
              fill: [white],
              wordWrap: true,
              wordWrapWidth: window.innerWidth * 0.8,
            })
          }
        />
        {/* TRUE box (left) */}
        <Graphics
          draw={(g) => {
            g.beginFill(
              hoveredBox === "left" ? 0x00ff00 : darkGray,
              hoveredBox === "left" ? 0.8 : 0.5
            );
            g.drawRect(trueBox.x, trueBox.y, trueBox.width, trueBox.height);
            g.endFill();
          }}
        />
        <Text
          text="TRUE"
          x={trueBox.x + trueBox.width / 2}
          y={trueBox.y + trueBox.height / 2}
          anchor={0.5}
          style={
            new PIXI.TextStyle({
              align: "center",
              fontFamily: "Futura",
              fontSize: "3em",
              fontWeight: 800,
              fill: [white],
            })
          }
        />
        {hoveredBox === "left" && (
          <Text
            text={`${Math.ceil(2 - hoverTime)}s`}
            x={trueBox.x + trueBox.width / 2}
            y={trueBox.y + trueBox.height / 2 + 40}
            anchor={0.5}
            style={
              new PIXI.TextStyle({
                align: "center",
                fontFamily: "Futura",
                fontSize: "1.5em",
                fontWeight: 600,
                fill: [yellow],
              })
            }
          />
        )}

        {/* FALSE box (right) */}
        <Graphics
          draw={(g) => {
            g.beginFill(
              hoveredBox === "right" ? 0xff0000 : darkGray,
              hoveredBox === "right" ? 0.8 : 0.5
            );
            g.drawRect(falseBox.x, falseBox.y, falseBox.width, falseBox.height);
            g.endFill();
          }}
        />
        <Text
          text="FALSE"
          x={falseBox.x + falseBox.width / 2}
          y={falseBox.y + falseBox.height / 2}
          anchor={0.5}
          style={
            new PIXI.TextStyle({
              align: "center",
              fontFamily: "Futura",
              fontSize: "3em",
              fontWeight: 800,
              fill: [white],
            })
          }
        />
        {hoveredBox === "right" && (
          <Text
            text={`${Math.ceil(2 - hoverTime)}s`}
            x={falseBox.x + falseBox.width / 2}
            y={falseBox.y + falseBox.height / 2 + 40}
            anchor={0.5}
            style={
              new PIXI.TextStyle({
                align: "center",
                fontFamily: "Futura",
                fontSize: "1.5em",
                fontWeight: 600,
                fill: [yellow],
              })
            }
          />
        )}
        {/* Cursor sprite */}
         <Sprite
          image={cursorIcon}
        x={cursorPos.x}
        y={cursorPos.y}
        interactive = {false}
        anchor={0.5}
        hitArea={new Rectangle(cursorPos.x, cursorPos.y, 76, 76)}
        />
        
        {/* Pose overlay */}
        <Pose poseData={poseData} colAttr={columnDimensions(2)} />
      </>
    );
  }

  // ---------- INSIGHT STAGE ----------
  if (isInsight) {
    useEffect(() => {
      const isRecording = true;
      const frameRate = 12;
      if (isRecording) {
        const intervalId = setInterval(() => {
          if (poseData) {
            bufferPoseDataWithAutoFlush(
              poseData,
              gameID,
              UUID,
              frameRate
            ).catch(handleWriteError);
          }
        }, 1000 / frameRate);
        return () => clearInterval(intervalId);
      }
    }, [poseData, UUID, gameID]);

    useEffect(() => {
      cursorTimerRef.current = setTimeout(() => setShowCursor(true), cursorTimer || 1000);
      return () => {
        if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
      };
    }, [cursorTimer]);

    const handleOnComplete = useCallback(() => {
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      onComplete();
    }, [onComplete]);

    return (
      <>
        <Graphics draw={drawGrayBackground} />
        <Text
          text={prompt}
          y={50}
          x={columnDimensions(1).x + columnDimensions(1).margin}
          style={
            new PIXI.TextStyle({
              align: "center",
              fontFamily: "Futura",
              fontSize: "4em",
              fontWeight: 800,
              fill: [white],
              wordWrap: true,
              wordWrapWidth: columnDimensions(2).width * 2,
            })
          }
        />
        <Pose poseData={poseData} colAttr={columnDimensions(3)} />
        {showCursor && (
          <>
            <CursorMode
              poseData={poseData}
              rowDimensions={rowDimensions}
              callback={handleOnComplete}
              colAttr={columnDimensions(3)}
            />
            <Text
              text={"When you're ready to move on, click the 'Next Arrow' to continue"}
              y={columnDimensions(1).y + 7 * (columnDimensions(1).height / 8)}
              x={columnDimensions(1).x + columnDimensions(1).margin}
              style={
                new PIXI.TextStyle({
                  align: "center",
                  fontFamily: "Futura",
                  fontSize: "3.5em",
                  fontWeight: 800,
                  fill: [white],
                  wordWrap: true,
                  wordWrapWidth: columnDimensions(1).width * 2,
                })
              }
            />
          </>
        )}
      </>
    );
  }

  // ---------- Fallback ----------
  return null;
};

export default ExperimentalTask;

