import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Container, Text, Graphics, Sprite } from '@inlet/react-pixi';
import Background from './Background';
import Pose from './Pose/index';
import { Rectangle } from "@pixi/math";
import { darkGray, yellow, white } from '../utils/colors';
import { writeToDatabaseMCAnswer } from '../firebase/database';

// Import cursor icon using URL constructor similar to CursorMode.js
const cursorIcon = new URL("../assets/cursor.png", import.meta.url).href;

const NewStage = ({ width, height, onComplete, gameID, poseData, columnDimensions, question = "What shape is this?", mcqChoices = { A: 'Choice A', B: 'Choice B', C: 'Choice C', D: 'Choice D' }, correctAnswer = 'A' }) => {
  const [hoveredBox, setHoveredBox] = useState(null);
  const [hoverTime, setHoverTime] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [showQuestion, setShowQuestion] = useState(true);
  const [questionOpacity, setQuestionOpacity] = useState(1.0);
  const [isHoveringButton, setIsHoveringButton] = useState(false);
  const hoverTimerRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const fadeIntervalRef = useRef(null);
  const questionTimerRef = useRef(null);
  const buttonPressRef = useRef(false);
  const hideQuestionTimerRef = useRef(null);

  // Visual spacing for clearer MCQ boxes
  const H_PAD = 24;   
  const V_PAD = 24;   
  const V_GAP = 24;   

  const computeOptionRects = (col) => {
    const innerX = col.x + H_PAD;
    const innerY = col.y + V_PAD;
    const innerW = Math.max(0, col.width  - 2 * H_PAD);
    const innerH = Math.max(0, col.height - 2 * V_PAD);

    const halfH = Math.max(0, (innerH - V_GAP) / 2);

    const top    = new Rectangle(innerX, innerY, innerW, halfH);
    const bottom = new Rectangle(innerX, innerY + halfH + V_GAP, innerW, halfH);
    return { top, bottom };
  };

  // Draw modal background with four individual rectangles for answer boxes
  const drawModalBackground = useCallback((g) => {
    g.beginFill(yellow, 0.9);
    g.drawRect(0, 0, window.innerWidth, window.innerHeight);
    g.endFill();
    
    const leftCol  = columnDimensions(1);
    const rightCol = columnDimensions(3);
    const L_bg = computeOptionRects(leftCol);
    const R_bg = computeOptionRects(rightCol);
    
    // Left TOP
    g.beginFill(darkGray, 0.3);
    g.drawRect(L_bg.top.x, L_bg.top.y, L_bg.top.width, L_bg.top.height);
    g.endFill();
    
    // Left BOTTOM
    g.beginFill(darkGray, 0.3);
    g.drawRect(L_bg.bottom.x, L_bg.bottom.y, L_bg.bottom.width, L_bg.bottom.height);
    g.endFill();
    
    // Right TOP
    g.beginFill(darkGray, 0.3);
    g.drawRect(R_bg.top.x, R_bg.top.y, R_bg.top.width, R_bg.top.height);
    g.endFill();
    
    // Right BOTTOM
    g.beginFill(darkGray, 0.3);
    g.drawRect(R_bg.bottom.x, R_bg.bottom.y, R_bg.bottom.width, R_bg.bottom.height);
    g.endFill();
  }, [columnDimensions]);

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
    }, 8000);
  }, [clearQuestionTimers, startFadeOut]);

  const hideQuestionOverlay = useCallback(() => {
    clearQuestionTimers();
    setShowQuestion(false);
    setQuestionOpacity(0);
  }, [clearQuestionTimers]);

  const handleQuestionButtonToggle = useCallback(() => {
    if (showQuestion) {
      hideQuestionOverlay();
    } else {
      startQuestionOverlay();
    }
  }, [hideQuestionOverlay, showQuestion, startQuestionOverlay]);

  // Keep onComplete ref up to date
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Question display: show for 8 seconds, then fade out over 2 seconds
  useEffect(() => {
    startQuestionOverlay();
    return () => {
      clearQuestionTimers();
    };
  }, [clearQuestionTimers, startQuestionOverlay]);

  const rectsOverlap = (a, b) => !(
    a.x + a.width  < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );

  const leftCol  = columnDimensions(1);
  const rightCol = columnDimensions(3);
  
  // Compute hit areas once (used for both rendering and hover detection)
  const L = computeOptionRects(leftCol);
  const R = computeOptionRects(rightCol);

  // Question bar dimensions (dynamic height based on content)
  const questionBarWidth = window.innerWidth * 0.8;
  const approxCharWidth = 20;
  const approxCharsPerLine = Math.max(1, Math.floor((questionBarWidth - 80) / approxCharWidth));
  const lineCount = Math.max(1, Math.ceil(question.length / approxCharsPerLine));
  const questionBarHeight = Math.max(120, lineCount * 48 + 60);
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

  // Custom hover detection for multiple choice boxes and question button
  useEffect(() => {
    const rightTip = poseData?.rightHandLandmarks?.[8];
    const leftTip  = poseData?.leftHandLandmarks?.[8];
    const lm = leftTip || rightTip;
    if (!lm) return;
  
    // Convert normalized coordinates to pixel coordinates
    const pos = {
      x: lm.x * window.innerWidth,
      y: lm.y * window.innerHeight,
    };
    setCursorPos(pos);

    const buttonRect = questionButtonRect;
    const cursorRadius = 20;
    const cursorArea = new Rectangle(pos.x - cursorRadius, pos.y - cursorRadius, cursorRadius * 2, cursorRadius * 2);
    const overButton = rectsOverlap(cursorArea, buttonRect);

    setIsHoveringButton(overButton);

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
    
    
    const hitAreas = {
      leftTop:     L.top,
      leftBottom:  L.bottom,
      rightTop:    R.top,
      rightBottom: R.bottom,
    };
  
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
  }, [poseData, columnDimensions, handleQuestionButtonToggle, hoveredBox, questionButtonRect, showQuestion]);
  
  // Timer for hiding question after cursor leaves button
  useEffect(() => {
    // Clear previous timer
    if (hideQuestionTimerRef.current) {
      clearTimeout(hideQuestionTimerRef.current);
      hideQuestionTimerRef.current = null;
    }

    // If cursor left button and question is shown - start 1 second timer
    if (!isHoveringButton && showQuestion) {
      hideQuestionTimerRef.current = setTimeout(() => {
        clearQuestionTimers();
        setShowQuestion(false);
        setQuestionOpacity(0);
        hideQuestionTimerRef.current = null;
      }, 1000);
    }

    return () => {
      if (hideQuestionTimerRef.current) {
        clearTimeout(hideQuestionTimerRef.current);
        hideQuestionTimerRef.current = null;
      }
    };
  }, [isHoveringButton, showQuestion, clearQuestionTimers]);
  
  // Hover dwell timer (2 seconds) - same as True/False
  useEffect(() => {
    if (!hoveredBox) {
      setHoverTime(0);
      return;
    }
  
    // Start 2-second timer on stable hover
    hoverTimerRef.current && clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      console.log("MCQ: Calling onComplete after stable 2s hover");
      // Map hoveredBox to answer (A, B, C, D)
      const answerMap = {
        'leftTop': 'A',
        'leftBottom': 'B',
        'rightTop': 'C',
        'rightBottom': 'D'
      };
      const selectedAnswer = answerMap[hoveredBox] || null;
      // Write answer to database
      if (gameID && selectedAnswer) {
        writeToDatabaseMCAnswer(selectedAnswer, correctAnswer || null, gameID, question || '').catch(console.error);
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
  }, [hoveredBox, gameID, correctAnswer, question]);

  const col2 = columnDimensions(2);


  return (
    <Container>
      <Graphics draw={drawModalBackground} />
      <Background height={height} width={width} />
      
      {/* MCQ boxes - only show after question phase */}
      {!showQuestion && (
        <>
          {/* Left Top Box */}
      <Container>
        <Graphics
          draw={(g) => {
            g.beginFill(hoveredBox === 'leftTop' ? 0x00ff00 : darkGray, 0.8);
            g.drawRect(L.top.x, L.top.y, L.top.width, L.top.height);
            g.endFill();
          }}
        />
        <Text
          text={mcqChoices.A}
          x={L.top.x + L.top.width / 2}
          y={L.top.y + L.top.height / 2}
          anchor={0.5}
          style={{
            align: "center",
            fontFamily: "Futura",
            fontSize: "2.5em",
            fontWeight: 800,
            fill: [white],
            wordWrap: true,
            wordWrapWidth: L.top.width - 40,
          }}
        />
        {hoveredBox === 'leftTop' && (
          <Text
            text={`${Math.ceil(2 - hoverTime)}s`}
            x={L.top.x + L.top.width / 2}
            y={L.top.y + L.top.height / 2 + 30}
            anchor={0.5}
            style={{
              align: "center",
              fontFamily: "Futura",
              fontSize: "1.5em",
              fontWeight: 600,
              fill: [yellow],
            }}
          />
        )}
      </Container>
      
      {/* Left Bottom Box */}
      <Container>
        <Graphics
          draw={(g) => {
            g.beginFill(hoveredBox === 'leftBottom' ? 0x00ff00 : darkGray, 0.8);
            g.drawRect(L.bottom.x, L.bottom.y, L.bottom.width, L.bottom.height);
            g.endFill();
          }}
        />
        <Text
          text={mcqChoices.B}
          x={L.bottom.x + L.bottom.width / 2}
          y={L.bottom.y + L.bottom.height / 2}
          anchor={0.5}
          style={{
            align: "center",
            fontFamily: "Futura",
            fontSize: "2.5em",
            fontWeight: 800,
            fill: [white],
            wordWrap: true,
            wordWrapWidth: L.bottom.width - 40,
          }}
        />
        {hoveredBox === 'leftBottom' && (
          <Text
            text={`${Math.ceil(2 - hoverTime)}s`}
            x={L.bottom.x + L.bottom.width / 2}
            y={L.bottom.y + L.bottom.height / 2 + 30}
            anchor={0.5}
            style={{
              align: "center",
              fontFamily: "Futura",
              fontSize: "1.5em",
              fontWeight: 600,
              fill: [yellow],
            }}
          />
        )}
      </Container>
      
      {/* Right Top Box */}
      <Container>
        <Graphics
          draw={(g) => {
            g.beginFill(hoveredBox === 'rightTop' ? 0x00ff00 : darkGray, 0.8);
            g.drawRect(R.top.x, R.top.y, R.top.width, R.top.height);
            g.endFill();
          }}
        />
        <Text
          text={mcqChoices.C}
          x={R.top.x + R.top.width / 2}
          y={R.top.y + R.top.height / 2}
          anchor={0.5}
          style={{
            align: "center",
            fontFamily: "Futura",
            fontSize: "2.5em",
            fontWeight: 800,
            fill: [white],
            wordWrap: true,
            wordWrapWidth: R.top.width - 40,
          }}
        />
        {hoveredBox === 'rightTop' && (
          <Text
            text={`${Math.ceil(2 - hoverTime)}s`}
            x={R.top.x + R.top.width / 2}
            y={R.top.y + R.top.height / 2 + 30}
            anchor={0.5}
            style={{
              align: "center",
              fontFamily: "Futura",
              fontSize: "1.5em",
              fontWeight: 600,
              fill: [yellow],
            }}
          />
        )}
      </Container>
      
      {/* Right Bottom Box */}
      <Container>
        <Graphics
          draw={(g) => {
            g.beginFill(hoveredBox === 'rightBottom' ? 0x00ff00 : darkGray, 0.8);
            g.drawRect(R.bottom.x, R.bottom.y, R.bottom.width, R.bottom.height);
            g.endFill();
          }}
        />
        <Text
          text={mcqChoices.D}
          x={R.bottom.x + R.bottom.width / 2}
          y={R.bottom.y + R.bottom.height / 2}
          anchor={0.5}
          style={{
            align: "center",
            fontFamily: "Futura",
            fontSize: "2.5em",
            fontWeight: 800,
            fill: [white],
            wordWrap: true,
            wordWrapWidth: R.bottom.width - 40,
          }}
        />
        {hoveredBox === 'rightBottom' && (
          <Text
            text={`${Math.ceil(2 - hoverTime)}s`}
            x={R.bottom.x + R.bottom.width / 2}
            y={R.bottom.y + R.bottom.height / 2 + 30}
            anchor={0.5}
            style={{
              align: "center",
              fontFamily: "Futura",
              fontSize: "1.5em",
              fontWeight: 600,
              fill: [yellow],
            }}
          />
        )}
      </Container>
        </>
      )}
      
      {/* Pose in center */}
      <Pose poseData={poseData} colAttr={col2} />
      
      {/* Cursor sprite  */}
      {!showQuestion && (
        <Sprite
          image={cursorIcon}
          x={cursorPos.x}
          y={cursorPos.y}
          interactive
          anchor={0.5}
          hitArea={new Rectangle(cursorPos.x, cursorPos.y, 76, 76)}
        />
      )}
      
      {/* Question overlay - appears at front, then fades after 5 seconds */}
      {showQuestion && (
        <Container alpha={questionOpacity}>
          {/* Dark gray bar background */}
          <Graphics
            draw={(g) => {
              g.beginFill(darkGray, 0.95);
              g.drawRect(questionBarX, questionBarY, questionBarWidth, questionBarHeight);
              g.endFill();
            }}
          />
          {/* Question text */}
          <Text
            text={question}
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
          text="Question"
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
    </Container>
  );
};



export default NewStage;

// const [timeLeft, setTimeLeft] = useState(20);
// const timer = setInterval(() => {
//   setTimeLeft((prev) => {
//     if (prev <= 1) {
//       console.log("NewStage: Calling onComplete from main timer");
//       onComplete();
//       return 0;
//     }
//     return prev - 1;
//   });
// }, 1000); // 1000ms = 1 second

// return () => clearInterval(timer);