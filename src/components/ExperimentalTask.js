import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import * as PIXI from "pixi.js";
import { Graphics, Text, Sprite, Container } from "@inlet/react-pixi";
import cursorIcon from '../assets/cursor.png';
import CursorMode from "./CursorMode.js";
import Pose from "./Pose/index";
import Background from "./Background";
import { white, darkGray, yellow } from "../utils/colors";
import { Rectangle } from "@pixi/math";
import { bufferPoseDataWithAutoFlush } from "../firebase/database.js";

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
    const [showQuestion, setShowQuestion] = useState(true);
    const [questionOpacity, setQuestionOpacity] = useState(1.0);
    const hoverTimerRef = useRef(null);
    const autoTimerRef = useRef(null);
    const onCompleteRef = useRef(onComplete);
    const fadeIntervalRef = useRef(null);
    const questionTimerRef = useRef(null);
    const buttonPressRef = useRef(false);
  
  
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
    
    // Draw background with low-opacity boxes that are always visible
    const drawIntuitionBackground = useCallback((g) => {
      g.beginFill(yellow, 0.9);
      g.drawRect(0, 0, window.innerWidth, window.innerHeight);
      g.endFill();
          
      // Left box (TRUE) - always visible with low opacity
      g.beginFill(darkGray, 0.3);
      g.drawRect(trueBox.x, trueBox.y, trueBox.width, trueBox.height);
      g.endFill();
          
      // Right box (FALSE) - always visible with low opacity
      g.beginFill(darkGray, 0.3);
      g.drawRect(falseBox.x, falseBox.y, falseBox.width, falseBox.height);
      g.endFill();
    }, [trueBox, falseBox]);


    const rectsOverlap = (a, b) => !(
      a.x + a.width < b.x ||
      a.x > b.x + b.width ||
      a.y + a.height < b.y ||
      a.y > b.y + b.height
    );



    // Question overlay functions
    const clearQuestionTimers = useCallback(() => {
      if (questionTimerRef.current) {
        clearTimeout(questionTimerRef.current);
        questionTimerRef.current = null;
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    }, []);

    const startFadeOut = useCallback(() => {
      const fadeDuration = 2000;
      const fadeSteps = 20;
      const stepDuration = fadeDuration / fadeSteps;
      const opacityStep = 1.0 / fadeSteps;

      let currentStep = 0;
      fadeIntervalRef.current = setInterval(() => {
        currentStep += 1;
        const newOpacity = Math.max(0, 1.0 - currentStep * opacityStep);
        setQuestionOpacity(newOpacity);

        if (currentStep >= fadeSteps) {
          clearQuestionTimers();
          setShowQuestion(false);
          setQuestionOpacity(0);
        }
      }, stepDuration);
    }, [clearQuestionTimers]);

    const startQuestionOverlay = useCallback(() => {
      clearQuestionTimers();
      setShowQuestion(true);
      setQuestionOpacity(1.0);

      questionTimerRef.current = setTimeout(() => {
        startFadeOut();
      }, 5000);
    }, [clearQuestionTimers, startFadeOut]);

    const hideQuestionOverlay = useCallback(() => {
      clearQuestionTimers();
      setShowQuestion(false);
      setQuestionOpacity(0);
    }, [clearQuestionTimers]);

    const restartMainTimer = useCallback(() => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
      }

      autoTimerRef.current = setTimeout(() => {
        console.log("Intuition: Calling onComplete from 50-second timer");
        // Clear hover timer if it exists
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        onCompleteRef.current();
      }, 50000);
    }, []);

    const handleQuestionButtonToggle = useCallback(() => {
      if (showQuestion) {
        hideQuestionOverlay();
      } else {
        startQuestionOverlay();
      }
      restartMainTimer();
    }, [hideQuestionOverlay, restartMainTimer, showQuestion, startQuestionOverlay]);

    // Keep onComplete ref up to date
    useEffect(() => {
      onCompleteRef.current = onComplete;
    }, [onComplete]);

    // Question display: show for 5 seconds, then fade out over 2 seconds
    useEffect(() => {
      startQuestionOverlay();
      return () => {
        clearQuestionTimers();
      };
    }, [clearQuestionTimers, startQuestionOverlay]);

    // 50-sec auto-timer
    useEffect(() => {
      restartMainTimer();
      
      return () => {
        if (autoTimerRef.current) {
          clearTimeout(autoTimerRef.current);
          autoTimerRef.current = null;
        }
      };
    }, [restartMainTimer]);

    // Question bar dimensions (dynamic height based on content)
    const questionBarWidth = window.innerWidth * 0.8;
    const approxCharWidth = 20;
    const approxCharsPerLine = Math.max(1, Math.floor((questionBarWidth - 80) / approxCharWidth));
    const lineCount = Math.max(1, Math.ceil(prompt.length / approxCharsPerLine));
    const questionBarHeight = Math.max(120, lineCount * 48 + 120);
    const questionBarX = (window.innerWidth - questionBarWidth) / 2;
    const questionBarY = (window.innerHeight - questionBarHeight) / 2;
    
    // Question button dimensions
    const questionButtonWidth = 180;
    const questionButtonHeight = 60;
    const questionButtonX = (window.innerWidth / 2) - (questionButtonWidth / 2);
    const questionButtonY = 32;
    const questionButtonRect = useMemo(
      () => new Rectangle(questionButtonX, questionButtonY, questionButtonWidth, questionButtonHeight),
      [questionButtonHeight, questionButtonWidth, questionButtonX, questionButtonY]
    );
  
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
  
      const buttonRect = questionButtonRect;
      const cursorRadius = 20;
      const cursorArea = new Rectangle(pos.x - cursorRadius, pos.y - cursorRadius, cursorRadius * 2, cursorRadius * 2);
      const overButton = rectsOverlap(cursorArea, buttonRect);
      
      // Check if cursor is over question button, so it can trigger question button toggle
      if (overButton) {
        if (!buttonPressRef.current) {
          buttonPressRef.current = true;
          handleQuestionButtonToggle();
        }
        setHoveredBox(null);
        return;
      } else {
        buttonPressRef.current = false;
      }

      // Don't detect hover during question display phase
      if (showQuestion) {
        setHoveredBox(null);
        return;
      }
  
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
    }, [poseData, columnDimensions, hoveredBox, trueBox, falseBox, questionButtonRect, handleQuestionButtonToggle, showQuestion]);

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
        <Graphics draw={drawIntuitionBackground} />
        <Background height={height} width={width} />
        
        {/* TRUE/FALSE boxes - only show after question phase */}
        {!showQuestion && (
          <>
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
          </>
        )}

        {/* Pose overlay */}
        <Pose poseData={poseData} colAttr={columnDimensions(2)} />

        {/* Cursor sprite - only show after question phase */}
        {!showQuestion && (
          <Sprite
            image={cursorIcon}
            x={cursorPos.x}
            y={cursorPos.y}
            interactive={false}
            anchor={0.5}
            hitArea={new Rectangle(cursorPos.x, cursorPos.y, 76, 76)}
          />
        )}

        {/* Question overlay - appears at front, then fades after 5 seconds */}
        {showQuestion && (
          <Container alpha={questionOpacity}>
            <Graphics
              draw={(g) => {
                g.beginFill(darkGray, 0.95);
                g.drawRect(questionBarX, questionBarY, questionBarWidth, questionBarHeight);
                g.endFill();
              }}
            />
            <Text 
              text={prompt} 
              x={window.innerWidth / 2} 
              y={window.innerHeight / 2} 
              anchor={0.5} 
              style={{
                align: "center",
                fontFamily: "Futura",
                fontSize: "3em",
                fontWeight: 800,
                fill: [white],
                wordWrap: true,
                wordWrapWidth: questionBarWidth - 80,
              }}
            />
          </Container>
        )}

        {/* Question toggle button (top-middle) */}
        <Container x={questionButtonX} y={questionButtonY}>
          <Graphics
            draw={(g) => {
              g.beginFill(0x4169e1, 1);
              g.drawRoundedRect(0, 0, questionButtonWidth, questionButtonHeight, 16);
              g.endFill();
            }}
          />
          <Text
            text="QUESTION"
            x={questionButtonWidth / 2}
            y={questionButtonHeight / 2}
            anchor={0.5}
            style={{
              align: "center",
              fontFamily: "Futura",
              fontSize: "1.8em",
              fontWeight: 700,
              fill: [white],
            }}
          />
        </Container>
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

