import React, { useState, useEffect } from 'react';
import { Graphics, Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { yellow, blue, green, white, red, black } from "../../utils/colors";
import InputBox from "../InputBox";
import Button from "../Button";
import { getEditLevel } from './ConjectureModule';
import { sanitizeValue } from "../../utils/sanitize";

function safeSetItem(key, val) {
  if (val !== undefined && val !== null && val.toString().trim() !== '') {
    localStorage.setItem(key, val);
  } else {
    localStorage.removeItem(key);
  }
}

function createInputBox(charLimit, scaleFactor, widthMultiplier, xMultiplier, yMultiplier, textKey, totalWidth, totalHeight, inputCallback, disabled = false, username = null) {
    // fetch value once
    const raw = localStorage.getItem(textKey);

  const placeholderMap = {
    'Conjecture Name':       'Type the name of this level here.',
    'Author Name':           'Author',
    'PIN':                   '4-digit PIN',
    'Conjecture Statement':  'Type conjecture statement here...',
    'Intuition Correct Answer': 'Select TRUE or FALSE',
    'Conjecture Keywords':   'Type in your keywords here (separate each with a comma followed by a space)',
    'Multiple Choice 1':     'Choice A',
    'Multiple Choice 2':     'Choice B',
    'Multiple Choice 3':     'Choice C',
    'Multiple Choice 4':     'Choice D',
  };


  let displayValue = sanitizeValue(raw);

  if (textKey === 'Author Name' && !displayValue && username) {
    displayValue = username;
  }

  const isPlaceholder = displayValue === '';  
const text = displayValue
    ? (displayValue.length > charLimit ? displayValue.slice(0, charLimit) + '…' : displayValue)
    : placeholderMap[textKey] ?? '';

  const height = totalHeight * scaleFactor;
  const width = totalWidth * widthMultiplier;
  const x = totalWidth * xMultiplier;
  const y = totalHeight * yMultiplier;

  return (
    <InputBox
      height={height}
      width={width}
      x={x}
      y={y}
      color={disabled ? blue : white}
      fontSize={totalWidth * 0.012}
      fontColor={disabled ? white : (isPlaceholder ? '#888' : black)}
      text={text}
      fontWeight={disabled ? 1000 : 500}
      callback={disabled ? null : () => {
        if(getEditLevel())
          inputCallback(textKey);
      }}
    />
  );
}

export const NameBox = (props) => {
  const { height, width, username, boxState } = props;
  const [, setRefresh] = useState(0);

  // Auto-populate author name with username if no previous author exists
  useEffect(() => {
    if (username && !localStorage.getItem('Author Name')) {
      localStorage.setItem('Author Name', username);
    }
  }, [username]);

  let titleText = "";
  if(getEditLevel())
    titleText = "Level Editor";
  else
    titleText = "Level Preview";

  function handleBoxInput(key) {
    const existingValue = localStorage.getItem(key);
    let newValue = prompt(`Please Enter Your Value for ${key}`, existingValue);

    if (newValue !== null) {
      // Apply character limit for Conjecture Statement
      if (key === 'Conjecture Statement' && newValue.length > 129) {
        newValue = newValue.slice(0, 129);
        alert('Text has been truncated to 129 characters.');
      }
      
      // Apply character limit for Multiple Choice fields
      if ((key === 'Multiple Choice 1' || key === 'Multiple Choice 2' || 
           key === 'Multiple Choice 3' || key === 'Multiple Choice 4') && 
          newValue.length > 205) {
        newValue = newValue.slice(0, 205);
        alert('Text has been truncated to 205 characters.');
      }
      
      localStorage.setItem(key, newValue);
      
      // Auto-sync Conjecture Statement to old fields for backward compatibility
      if (key === 'Conjecture Statement') {
        localStorage.setItem('Intuition Description', newValue);
        localStorage.setItem('MCQ Question', newValue);
        localStorage.setItem('Conjecture Description', newValue);
      }
      
      setRefresh((n) => n + 1);
    }
  }

  return (
    <>
      {/* charLimit, scaleFactor, widthMultiplier, xMultiplier, yMultiplier, textKey, totalWidth, totalHeight, callback*/}
      {createInputBox(220, 0.19, 1.595, 0.134, 0.57, 'Multiple Choice 1', width, height, handleBoxInput)}
      {createInputBox(220, 0.19, 1.595, 0.134, 0.66, 'Multiple Choice 2', width, height, handleBoxInput)}
      {createInputBox(220, 0.19, 1.595, 0.134, 0.75, 'Multiple Choice 3', width, height, handleBoxInput)}
      {createInputBox(220, 0.19, 1.595, 0.134, 0.84, 'Multiple Choice 4', width, height, handleBoxInput)}
      {createInputBox(60, 0.10, 0.54, 0.143+ 0.062, 0.136-.050, 'Conjecture Name', width, height, handleBoxInput)}
      {createInputBox(220, 0.10, .3, 0.46+ 0.062, 0.136-.050, 'Author Name', width, height, null, true, username)}
      {/* KEYWORDS box: positioned right below NAME/AUTHOR/PIN boxes with small gap (0.5cm ≈ 0.018) */}
      {createInputBox(220, 0.10, 1.268, 0.203 + 0.062, 0.158, 'Conjecture Keywords', width, height, handleBoxInput)}
      {/* Conjecture Statement box: 1cm gap after keywords box (0.035) - unified field for both intuition and MCQ */}
      {createInputBox(220, 0.15, 1.0, 0.134, 0.230, 'Conjecture Statement', width, height, handleBoxInput)}
      {/* Intuition Correct Answer buttons - positioned to the right of Conjecture Statement */}
      <IntuitionCorrectAnswerBox height={height} width={width} />

      {/* text, xMultiplier, yMultiplier, fontSizeMultiplier, totalWidth, totalHeight, color */}
      {/* KEYWORDS label: positioned above keywords box */}
      {createTextElement("KEYWORDS:", 0.137+ 0.065, 0.184, 0.018, width, height)}
      {createTextElement("PIN:", 0.605+ 0.062, 0.155-0.05, 0.018, width, height)}
      {createTextElement("AUTHOR:", 0.41+ 0.062, 0.155-0.05, 0.018, width, height)}
      {/* CURRENT M-CLIP moved down below MCQ box to avoid hitbox overlap */}
      {createTextElement("CURRENT M-CLIP:", 0.45, 0.35, 0.018, width, height)}
      {createTextElement(titleText, 0.45, 0.05, 0.025, width, height)}
      {createTextElement("NAME:", 0.108+ 0.062, 0.155-0.05, 0.018, width, height)}

    </>
  );
}

function createTextElement(text, xMultiplier, yMultiplier, fontSizeMultiplier, totalWidth, totalHeight, color = blue) {
  return (
    <Text
      text={text}
      x={totalWidth * xMultiplier}
      y={totalHeight * yMultiplier}
      style={
        new TextStyle({
          align: "left",
          fontFamily: "Arial",
          fontSize: totalWidth * fontSizeMultiplier,
          fontWeight: 800,
          fill: [color],
          letterSpacing: 0,
        })
      }
      anchor={0.5}
    />
  );
}

export const PINBox = (props) => {
  const { height, width } = props;
  const [, setRefresh] = useState(0);

  // Creates a popup in which the user can set a pin for their conjecture
    /* 1.  local state mirrors storage so UI is stable */
const [pinValue, setPinValue] = useState(
  sanitizeValue(localStorage.getItem('PIN'))
);
  /* 2.  popup handler */
  function pinBoxInput() {
    if (!getEditLevel()) return;

    const newPin = prompt('Please enter a 4-digit PIN', pinValue);

    if (newPin === null) return;                 // user hit Cancel
    if (isNaN(newPin))  return alert('PIN must be numeric');

  safeSetItem('PIN', newPin);    
  setPinValue(newPin);                         // ← triggers rerender, no flicker
  }

  // Determine what text to display
  let displayText;
  let fontColor;

  if (!getEditLevel()) {
    // In preview mode, always show asterisks
    displayText = '****';
    fontColor = black;
  } else if (pinValue) {
    // In edit mode with a PIN set, show the actual PIN
    displayText = pinValue;
    fontColor = black;
  } else {
    // No PIN set, show placeholder
    displayText = '4-digit PIN';
    fontColor = '#888';
  }

  return (
      <>
      {/* PINBox InputBox */}
      <InputBox
        height={height * 0.10}
        width={width * 0.2}
        x={width * 0.6910}
        y={height * 0.085}
        color={white}
        fontSize={width * 0.013}
        text={displayText}
        fontColor={fontColor}
        fontWeight={300}
        callback={pinBoxInput} // Create Popup
      />
      </>
  )
}

export const PublicCheckbox = (props) => {
  const { height, width } = props;
  const [isPublic, setIsPublic] = useState(localStorage.getItem('isPublic') === 'true');
  const [, setRefresh] = useState(0);

  function togglePublic() {
    if (!getEditLevel()) return;
    
    const newValue = !isPublic;
    setIsPublic(newValue);
    localStorage.setItem('isPublic', newValue ? 'true' : 'false');
    setRefresh((n) => n + 1);
  }

  return (
    <>
      <Text
        x={width * 0.6910}
        y={height * 0.33}
        text="PUBLIC:"
        style={new TextStyle({
          fontFamily: 'Arial',
          fontSize: width * 0.012,
          fontWeight: 600,
          fill: [black],
        })}
      />
      <InputBox
        height={height * 0.08}
        width={width * 0.15}
        x={width * 0.75}
        y={height * 0.33}
        color={isPublic ? green : white}
        fontSize={width * 0.012}
        text={isPublic ? 'YES' : 'NO'}
        fontColor={isPublic ? white : black}
        fontWeight={600}
        callback={togglePublic}
      />
    </>
  );
}

export const IntuitionCorrectAnswerBox = (props) => {
  const { height, width } = props;
  const [correctAnswer, setCorrectAnswer] = useState(
    localStorage.getItem('Intuition Correct Answer') || null
  );
  const [, setRefresh] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('Intuition Correct Answer');
    setCorrectAnswer(stored);
  }, []);

  function handleAnswerSelect(answer) {
    if (!getEditLevel()) return;
    
    localStorage.setItem('Intuition Correct Answer', answer);
    setCorrectAnswer(answer);
    setRefresh((n) => n + 1);
  }

  return (
    <>
      <Text
        x={width * 0.538}
        y={height * 0.230}
        text="CORRECT:"
        style={new TextStyle({
          fontFamily: 'Arial',
          fontSize: width * 0.012,
          fontWeight: 600,
          fill: [black],
        })}
      />
      <Button
        height={height * 0.03}
        width={width * 0.03}
        x={width * 0.62}
        y={height * 0.26}
        color={correctAnswer === 'TRUE' ? green : blue}
        fontSize={width * 0.007}
        fontColor={correctAnswer === 'TRUE' ? black : white}
        text={correctAnswer === 'TRUE' ? 'TRUE ✓' : 'TRUE'}
        fontWeight={100}
        callback={() => handleAnswerSelect('TRUE')}
      />
      <Button
        height={height * 0.03}
        width={width * 0.03}
        x={width * 0.65}
        y={height * 0.26}
        color={correctAnswer === 'FALSE' ? green : blue}
        fontSize={width * 0.007}
        fontColor={correctAnswer === 'FALSE' ? black : white}
        text={correctAnswer === 'FALSE' ? 'FALSE ✓' : 'FALSE'}
        fontWeight={100}
        callback={() => handleAnswerSelect('FALSE')}
      />
    </>
  );
}