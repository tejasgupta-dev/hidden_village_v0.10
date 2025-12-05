import React, { useState, useCallback, useEffect, useRef } from "react";
import { Container, Graphics, Text } from "@inlet/react-pixi";
import RectButton from "./RectButton";
import SettingRow from "./SettingRow";
import { setUserSettings, getUserSettings } from "../firebase/userSettings.js";

// FPS Input component using DOM input element
const FpsInput = ({ x, y, value, onChange, parentX = 0, parentY = 0 }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    // Create input element
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.style.position = "fixed";
    input.style.width = "60px";
    input.style.height = "32px";
    input.style.border = "2px solid #9ca3af";
    input.style.borderRadius = "4px";
    input.style.padding = "4px 8px";
    input.style.fontSize = "16px";
    input.style.fontFamily = "Arial";
    input.style.textAlign = "center";
    input.style.backgroundColor = "#ffffff";
    input.style.color = "#111827";
    input.style.zIndex = "10000";
    input.id = "fps-input-settings";

    // Function to update position
    const updatePosition = () => {
      const canvas = document.querySelector("canvas");
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / canvas.clientWidth;
        const scaleY = canvas.height / canvas.clientHeight;
        input.style.left = `${rect.left + parentX + x * scaleX}px`;
        input.style.top = `${rect.top + parentY + y * scaleY}px`;
      }
    };

    updatePosition();

    // Handle input validation - only numbers
    const handleInput = (e) => {
      const inputValue = e.target.value;
      // Allow only digits
      if (inputValue === "" || /^\d+$/.test(inputValue)) {
        const numValue = parseInt(inputValue, 10);
        if (inputValue === "" || (numValue >= 1 && numValue <= 30)) {
          onChange(inputValue);
        } else {
          // Revert to previous valid value
          e.target.value = value;
        }
      } else {
        // Revert to previous valid value
        e.target.value = value;
      }
    };

    // Handle blur - validate range and update
    const handleBlur = (e) => {
      const numValue = parseInt(e.target.value, 10);
      if (isNaN(numValue) || numValue < 1) {
        e.target.value = "1";
        onChange("1");
      } else if (numValue > 30) {
        e.target.value = "30";
        onChange("30");
      } else {
        onChange(String(numValue));
      }
    };

    input.addEventListener("input", handleInput);
    input.addEventListener("blur", handleBlur);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    document.body.appendChild(input);
    inputRef.current = input;

    return () => {
      if (inputRef.current) {
        inputRef.current.removeEventListener("input", handleInput);
        inputRef.current.removeEventListener("blur", handleBlur);
        if (document.body.contains(inputRef.current)) {
          document.body.removeChild(inputRef.current);
        }
      }
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [x, y, value, onChange, parentX, parentY]);

  // Update input value when value prop changes
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== String(value)) {
      inputRef.current.value = value;
    }
  }, [value]);

  return null; // This component doesn't render anything in Pixi
};

// Typography
const TITLE_STYLE = {
  fontFamily: "Arial",
  fontSize: 26,
  fontWeight: "900",
  fill: 0x1e3a8a, // blue-900
  letterSpacing: 1.5,
};
const SECTION_STYLE = {
  fontFamily: "Arial",
  fontSize: 13,
  fontWeight: "800",
  fill: 0x6b7280, // gray-500
  letterSpacing: 1.2,
};
const LABEL_STYLE = {
  fontFamily: "Arial",
  fontSize: 16,
  fill: 0x111827, // gray-900
};

const Settings = ({ width, height, x, y, onClose }) => {
  // Layout constants
  const MARGIN = 20;           // outer card margin
  const PAD = 20;              // inner content padding
  const COL_GAP = 56;          // space between columns
  const COL_W = (width - MARGIN * 2 - COL_GAP - PAD * 2) / 2;

  const leftColX = MARGIN + PAD;
  const rightColX = leftColX + COL_W + COL_GAP;

  const firstRowY = 96; // first toggle row y
  const rowSpacing = 40; // vertical spacing between rows

  // State
  const [settings, setSettings] = useState({
    story: true,
    poseMatching: true,
    intuition: true,
    insight: true,
    multipleChoice: true,
    tween: true,
    repetitions: 3, // number of pose match repetitions
    audioRecording: true,
    videoRecording: true,
    fps: 30,
    research: true,
    teaching: false,
    closedCaptions: true,
    visualAssist: false,
    textToSpeech: true,
    pip: false,
    NumberOfhints: 4,
    language: "English",
  });

  // Load saved settings on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await getUserSettings();
        if (mounted && saved) {
          setSettings((prev) => ({ ...prev, ...saved }));
        }
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleSetting = (key) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const updateRepetitions = (increment) =>
    setSettings((prev) => ({
      ...prev,
      repetitions: Math.max(1, prev.repetitions + increment),
    }));

  const updateNumberOfhints = (increment) =>
    setSettings((prev) => ({
      ...prev,
      NumberOfhints: Math.max(0, prev.NumberOfhints + increment),
    }));

  const updateFps = (value) => {
    // Validate: only numbers, between 1 and 30
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 30) {
      setSettings((prev) => ({
        ...prev,
        fps: numValue,
      }));
    }
  };

  const updateLanguage = () =>
    setSettings((prev) => ({
      ...prev,
      language: prev.language === "English" ? "Spanish" : "English",
    }));

  const saveSettings = async () => {
    try {
      await setUserSettings(settings);
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  };

  const handleClose = async () => {
    await saveSettings();
    onClose();
  };

  // Background & card
  const drawBackground = useCallback(
    (g) => {
      g.clear();

      // soft background
      g.beginFill(0xf9fafb); // gray-50
      g.drawRect(0, 0, width, height);
      g.endFill();

      // drop shadow
      const cardWidth = width - MARGIN * 2;
      const cardHeight = height - MARGIN * 2;
      const radius = 14;

      g.beginFill(0x000000, 0.08);
      g.drawRoundedRect(MARGIN + 4, MARGIN + 6, cardWidth, cardHeight, radius);
      g.endFill();

      // foreground card
      g.beginFill(0xffffff);
      g.drawRoundedRect(MARGIN, MARGIN, cardWidth, cardHeight, radius);
      g.endFill();

      // top divider line (under title)
      g.lineStyle(1, 0xe5e7eb, 1);
      g.moveTo(MARGIN + PAD, 72);
      g.lineTo(width - MARGIN - PAD, 72);
      g.lineStyle(0);
    },
    [width, height]
  );

  return (
    <Container position={[x, y]} zIndex={100}>
      <Graphics draw={drawBackground} />

      {/* Title */}
      <Text
        text="SETTINGS"
        style={TITLE_STYLE}
        x={width / 2}
        y={36}
        anchor={0.5}
      />

      {/* LEFT COLUMN */}
      {/* Game Modules */}
      <Text
        text="GAME MODULES"
        style={SECTION_STYLE}
        x={leftColX}
        y={firstRowY - 24}
      />

      <SettingRow
        label="Story:"
        value={settings.story}
        x={leftColX}
        y={firstRowY + rowSpacing * 0}
        onToggle={() => toggleSetting("story")}
      />
      <SettingRow
        label="Pose Matching:"
        value={settings.poseMatching}
        x={leftColX}
        y={firstRowY + rowSpacing * 1}
        onToggle={() => toggleSetting("poseMatching")}
      />

      <SettingRow
        label="Intuition:"
        value={settings.intuition}
        x={leftColX}
        y={firstRowY + rowSpacing * 2}
        onToggle={() => toggleSetting("intuition")}
      />

      <SettingRow
        label="Insight:"
        value={settings.insight}
        x={leftColX}
        y={firstRowY + rowSpacing * 3}
        onToggle={() => toggleSetting("insight")}
      />

      <SettingRow
        label="Multiple Choice:"
        value={settings.multipleChoice}
        x={leftColX}
        y={firstRowY + rowSpacing * 4}
        onToggle={() => toggleSetting("multipleChoice")}
      />

      {/* Motion */}
      <Text
        text="MOTION"
        style={SECTION_STYLE}
        x={leftColX}
        y={firstRowY + 200}
      />

      <SettingRow
        label="Tween:"
        value={settings.tween}
        x={leftColX}
        y={firstRowY + rowSpacing * 5.5}
        onToggle={() => toggleSetting("tween")}
      />

      {/* Repetitions with +/- buttons */}
      <Container position={[leftColX, firstRowY + rowSpacing * 6.5]}>
        <Text text="Repetitions:" style={LABEL_STYLE} y={0} />
        <RectButton
          width={40}
          height={32}
          x={200}
          y={-2}
          text="-"
          color="#9ca3af"
          fontColor="white"
          callback={() => updateRepetitions(-1)}
        />
        <Text
          text={`${settings.repetitions}`}
          style={LABEL_STYLE}
          x={250}
          y={0}
        />
        <RectButton
          width={40}
          height={32}
          x={300}
          y={-2}
          text="+"
          color="#2563eb"
          fontColor="white"
          callback={() => updateRepetitions(1)}
        />
      </Container>

      
      

      {/* RIGHT COLUMN */}
      {/* Data */}
      <Text
        text="DATA"
        style={SECTION_STYLE}
        x={rightColX}
        y={firstRowY - 24}
      />
      <SettingRow
        label="Audio Recording:"
        value={settings.audioRecording}
        x={rightColX}
        y={firstRowY + rowSpacing * 0}
        onToggle={() => toggleSetting("audioRecording")}
      />
      <SettingRow
        label="Video Recording:"
        value={settings.videoRecording}
        x={rightColX}
        y={firstRowY + rowSpacing * 1}
        onToggle={() => toggleSetting("videoRecording")}
      />
      {/* FPS with input field */}
      <Container position={[rightColX, firstRowY + rowSpacing * 2]}>
        <Text text="FPS:" style={LABEL_STYLE} y={0} />
        <FpsInput
          x={120}
          y={0}
          value={settings.fps}
          onChange={updateFps}
          parentX={x + rightColX}
          parentY={y + firstRowY + rowSpacing * 2}
        />
      </Container>

      {/* Mode */}
      <Text
        text="MODE"
        style={SECTION_STYLE}
        x={rightColX}
        y={firstRowY + rowSpacing * 3 - 24}
      />
      <SettingRow
        label="Research:"
        value={settings.research}
        x={rightColX}
        y={firstRowY + rowSpacing * 3}
        onToggle={() => toggleSetting("research")}
      />
      <SettingRow
        label="Teaching:"
        value={settings.teaching}
        x={rightColX}
        y={firstRowY + rowSpacing * 4}
        onToggle={() => toggleSetting("teaching")}
      />

      {/* Accessibility */}
      <Text
        text="ACCESSIBILITY"
        style={SECTION_STYLE}
        x={rightColX}
        y={firstRowY + rowSpacing * 5 - 24}
      />
      <SettingRow
        label="Closed Captions:"
        value={settings.closedCaptions}
        x={rightColX}
        y={firstRowY + rowSpacing * 5}
        onToggle={() => toggleSetting("closedCaptions")}
      />
      <SettingRow
        label="Visual Assist:"
        value={settings.visualAssist}
        x={rightColX}
        y={firstRowY + rowSpacing * 6}
        onToggle={() => toggleSetting("visualAssist")}
      />
      <SettingRow
        label="Text to Speech:"
        value={settings.textToSpeech}
        x={rightColX}
        y={firstRowY + rowSpacing * 7}
        onToggle={() => toggleSetting("textToSpeech")}
      />

      {/* Number of Hints with +/- buttons */}
      <Container position={[rightColX, firstRowY + rowSpacing * 8]}>
        <Text text="Number of Hints:" style={LABEL_STYLE} y={0} />
        <RectButton
          width={40}
          height={32}
          x={200}
          y={-2}
          text="-"
          color="#9ca3af"
          fontColor="white"
          callback={() => updateNumberOfhints(-1)}
        />
        <Text
          text={`${settings.NumberOfhints}`}
          style={LABEL_STYLE}
          x={250}
          y={0}
        />
        <RectButton
          width={40}
          height={32}
          x={300}
          y={-2}
          text="+"
          color="#2563eb"
          fontColor="white"
          callback={() => updateNumberOfhints(1)}
        />
      </Container>

      {/* Language toggle */}
      <SettingRow
        label="Language:"
        value={settings.language === "English"}
        x={rightColX}
        y={firstRowY + rowSpacing * 9}
        onToggle={updateLanguage}
      />
      <Text
        text={`(${settings.language})`}
        style={{
          fontFamily: "Arial",
          fontSize: 12,
          fill: 0x6b7280,
        }}
        x={rightColX + 360}
        y={firstRowY + rowSpacing * 9}
      />

      {/* Close */}
      <RectButton
        width={180}
        height={48}
        x={width / 2 - 90}
        y={height - MARGIN - 56}
        text="CLOSE"
        color="red"
        fontColor="white"
        fontWeight="bold"
        callback={handleClose}
      />
    </Container>
  );
};

export default Settings;
