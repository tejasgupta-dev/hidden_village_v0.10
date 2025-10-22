import React, { useState, useEffect } from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { blue, white, black } from "../../utils/colors";
import RectButton from "../RectButton";

const TextInput = ({ 
  x, 
  y, 
  width, 
  height, 
  placeholder = "Enter text...", 
  value = "", 
  onChange, 
  onSubmit,
  fontSize = 14,
  maxLength = 50
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && onSubmit) {
      onSubmit(inputValue);
    }
  };

  const handleClick = () => {
    setIsFocused(true);
    // In a real implementation, you would focus a real input element
    // For now, we'll just simulate it
  };

  const displayText = inputValue || placeholder;
  const textColor = inputValue ? black : [0.7, 0.7, 0.7];

  return (
    <>
      {/* Input background */}
      <RectButton
        height={height}
        width={width}
        x={x}
        y={y}
        color={isFocused ? white : [0.95, 0.95, 0.95]}
        callback={handleClick}
      />
      
      {/* Input text */}
      <Text
        text={displayText}
        x={x + 10}
        y={y + height/2 - fontSize/2}
        style={new TextStyle({
          align: "left",
          fontFamily: "Arial",
          fontSize: fontSize,
          fontWeight: "normal",
          fill: textColor,
        })}
      />
      
      {/* Cursor (simple blinking effect) */}
      {isFocused && (
        <Text
          text="|"
          x={x + 10 + (displayText.length * fontSize * 0.6)}
          y={y + height/2 - fontSize/2}
          style={new TextStyle({
            align: "left",
            fontFamily: "Arial",
            fontSize: fontSize,
            fontWeight: "normal",
            fill: [blue],
          })}
        />
      )}
    </>
  );
};

export default TextInput;
