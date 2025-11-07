import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Container, Text, Graphics, Sprite } from '@inlet/react-pixi';
import Background from './Background';
import Pose from './Pose/index';
import { Rectangle } from "@pixi/math";
import { darkGray, yellow, white } from '../utils/colors';
import cursorIcon from '../assets/cursor.png';

const NewStage = ({ width, height, onComplete, gameID, poseData, columnDimensions, question = "What shape is this?" }) => {
  const [hoveredBox, setHoveredBox] = useState(null);
  const [hoverTime, setHoverTime] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const hoverTimerRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const mainTimerRef = useRef(null);

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

  // Keep onComplete ref up to date
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // 20-second main timer
  useEffect(() => {
    mainTimerRef.current = setTimeout(() => {
      console.log("NewStage: Calling onComplete from main timer");
      onCompleteRef.current();
    }, 20000);

    return () => {
      if (mainTimerRef.current) {
        clearTimeout(mainTimerRef.current);
        mainTimerRef.current = null;
      }
    };
  }, []);

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

  // Custom hover detection for multiple choice boxes
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
    
    
    const hitAreas = {
      leftTop:     L.top,
      leftBottom:  L.bottom,
      rightTop:    R.top,
      rightBottom: R.bottom,
    };
  
    const cursorRadius = 20; // half-size in px (adjustable)
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
  }, [poseData, columnDimensions, hoveredBox]);
  
  
  // B) TIMER tied ONLY to hoveredBox changes
  useEffect(() => {
    if (!hoveredBox) return;
  
    hoverTimerRef.current && clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      // Clear main timer if it exists
      if (mainTimerRef.current) {
        clearTimeout(mainTimerRef.current);
        mainTimerRef.current = null;
      }
      onCompleteRef.current();   // will actually fire now
    }, 2000);
  
    // show countdown (optional)
    const tick = setInterval(() => setHoverTime((t) => Math.min(2, t + 0.1)), 100);
    return () => {
      clearTimeout(hoverTimerRef.current);
      clearInterval(tick);
      hoverTimerRef.current = null;
      setHoverTime(0);
    };
  }, [hoveredBox]);

  const col2 = columnDimensions(2);


  return (
    <Container>
      <Graphics draw={drawModalBackground} />
      <Background height={height} width={width} />
      
      {/* Question at the top */}
      <Text
        text={question}
        y={50}
        x={window.innerWidth / 2}
        anchor={0.5}
        style={{
          align: "center",
          fontFamily: "Futura",
          fontSize: "3em",
          fontWeight: 800,
          fill: [white],
          wordWrap: true,
          wordWrapWidth: window.innerWidth * 0.8,
        }}
      />
      
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
          text="6"
          x={L.top.x + L.top.width / 2}
          y={L.top.y + L.top.height / 2}
          anchor={0.5}
          style={{
            align: "center",
            fontFamily: "Futura",
            fontSize: "2.5em",
            fontWeight: 800,
            fill: [white],
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
          text="3"
          x={L.bottom.x + L.bottom.width / 2}
          y={L.bottom.y + L.bottom.height / 2}
          anchor={0.5}
          style={{
            align: "center",
            fontFamily: "Futura",
            fontSize: "2.5em",
            fontWeight: 800,
            fill: [white],
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
          text="None"
          x={R.top.x + R.top.width / 2}
          y={R.top.y + R.top.height / 2}
          anchor={0.5}
          style={{
            align: "center",
            fontFamily: "Futura",
            fontSize: "2.5em",
            fontWeight: 800,
            fill: [white],
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
          text="4"
          x={R.bottom.x + R.bottom.width / 2}
          y={R.bottom.y + R.bottom.height / 2}
          anchor={0.5}
          style={{
            align: "center",
            fontFamily: "Futura",
            fontSize: "2.5em",
            fontWeight: 800,
            fill: [white],
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
      
      {/* Pose in center - On top of hitboxes so it's always visible */}
      <Pose poseData={poseData} colAttr={col2} />
      
      {/* Cursor sprite that follows hand position - On top of everything */}
      <Sprite
        image={cursorIcon}
        x={cursorPos.x}
        y={cursorPos.y}
        interactive
        anchor={0.5}
        hitArea={new Rectangle(cursorPos.x, cursorPos.y, 76, 76)}
      />
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