import React, { useCallback, useState, useEffect } from "react";
import { Container, Graphics, Text } from "@inlet/react-pixi";
import RectButton from "./RectButton";
import SettingRow from "./SettingRow";
import { setUserSettings, getUserSettings } from "../firebase/userSettings.js";

// Typography
const TITLE_STYLE = {
  fontFamily: "Arial",
  fontSize: 26,
  fontWeight: "900",
  fill: 0x1e3a8a,
  letterSpacing: 1.5,
};

const LABEL_STYLE = {
  fontFamily: "Arial",
  fontSize: 16,
  fill: 0x111827,
};

const SECTION_STYLE = {
  fontFamily: "Arial",
  fontSize: 13,
  fontWeight: "800",
  fill: 0x6b7280,
  letterSpacing: 1.2,
};

const GameSettings = ({ width, height, x, y, onClose }) => {
  const MARGIN = 20;
  const PAD = 20;

  // Local state for simple placeholder settings
  const [settings, setSettings] = useState({
    sound: true,
    music: true,
    closedCaption: false,
    visualAssist: false,
    textToSpeech: false,
    pip: false,
    language: "English", //language setting
  });

  // local UI state for dropdown
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  // Load saved settings on mount (if any) -- placeholders only
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await getUserSettings();
      if (mounted && saved) {
        setSettings((prev) => ({ ...prev, ...saved }));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveSettings = async () => {
    try {
      await setUserSettings(settings);
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  };

  const toggleSetting = (key) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  // Background & card
  const drawBackground = useCallback(
    (g) => {
      g.clear();
      g.beginFill(0xf9fafb);
      g.drawRect(0, 0, width, height);
      g.endFill();

      const cardWidth = width - MARGIN * 2;
      const cardHeight = height - MARGIN * 2;
      const radius = 14;

      g.beginFill(0x000000, 0.08);
      g.drawRoundedRect(MARGIN + 4, MARGIN + 6, cardWidth, cardHeight, radius);
      g.endFill();

      g.beginFill(0xffffff);
      g.drawRoundedRect(MARGIN, MARGIN, cardWidth, cardHeight, radius);
      g.endFill();

      g.lineStyle(1, 0xe5e7eb, 1);
      g.moveTo(MARGIN + PAD, 72);
      g.lineTo(width - MARGIN - PAD, 72);
      g.lineStyle(0);
    },
    [width, height]
  );

  const colX = MARGIN + PAD;
  const firstRowY = 96;
  const rowSpacing = 48;

  // Save then close handler
  const handleClose = async () => {
    await saveSettings();
    onClose();
  };

  return (
    <Container position={[x, y]} zIndex={100}>
      <Graphics draw={drawBackground} />

      {/* Title */}
      <Text
        text="GAME SETTINGS"
        style={TITLE_STYLE}
        x={width / 2}
        y={36}
        anchor={0.5}
      />
      <Text text="Audio" style={SECTION_STYLE} x={colX} y={firstRowY - 24} />

      {/* Sound checkbox placeholder */}
      <Text text="Sound:" style={LABEL_STYLE} x={colX} y={firstRowY} />
      <RectButton
        width={80}
        height={32}
        x={colX + 220}
        y={firstRowY - 2}
        text={settings.sound ? "ON" : "OFF"}
        color={settings.sound ? "#10b981" : "#9ca3af"}
        fontColor="white"
        callback={() => toggleSetting("sound")}
      />

      {/* Music checkbox placeholder */}
      <Text
        text="Music:"
        style={LABEL_STYLE}
        x={colX}
        y={firstRowY + rowSpacing}
      />
      <RectButton
        width={80}
        height={32}
        x={colX + 220}
        y={firstRowY + rowSpacing - 2}
        text={settings.music ? "ON" : "OFF"}
        color={settings.music ? "#10b981" : "#9ca3af"}
        fontColor="white"
        callback={() => toggleSetting("music")}
      />

      <Text text="Access" style={SECTION_STYLE} x={colX + 400} y={firstRowY - 24} />

      {/* Access checkboxes (placeholders) */}
      <Text
        text="Closed-Caption:"
        style={LABEL_STYLE}
        x={colX + 400}
        y={firstRowY}
      />
      <RectButton
        width={80}
        height={32}
        x={colX + 620}
        y={firstRowY - 2}
        text={settings.closedCaption ? "ON" : "OFF"}
        color={settings.closedCaption ? "#10b981" : "#9ca3af"}
        fontColor="white"
        callback={() => toggleSetting("closedCaption")}
      />

      <Text
        text="Visual Assist:"
        style={LABEL_STYLE}
        x={colX + 400}
        y={firstRowY + rowSpacing}
      />
      <RectButton
        width={80}
        height={32}
        x={colX + 620}
        y={firstRowY + rowSpacing - 2}
        text={settings.visualAssist ? "ON" : "OFF"}
        color={settings.visualAssist ? "#10b981" : "#9ca3af"}
        fontColor="white"
        callback={() => toggleSetting("visualAssist")}
      />

      <Text
        text="Text To Speech:"
        style={LABEL_STYLE}
        x={colX + 400}
        y={firstRowY + rowSpacing * 2}
      />
      <RectButton
        width={80}
        height={32}
        x={colX + 620}
        y={firstRowY + rowSpacing * 2 - 2}
        text={settings.textToSpeech ? "ON" : "OFF"}
        color={settings.textToSpeech ? "#10b981" : "#9ca3af"}
        fontColor="white"
        callback={() => toggleSetting("textToSpeech")}
      />

      <Text
        text="PIP:"
        style={LABEL_STYLE}
        x={colX + 400}
        y={firstRowY + rowSpacing * 3}
      />
      <RectButton
        width={80}
        height={32}
        x={colX + 620}
        y={firstRowY + rowSpacing * 3 - 2}
        text={settings.pip ? "ON" : "OFF"}
        color={settings.pip ? "#10b981" : "#9ca3af"}
        fontColor="white"
        callback={() => toggleSetting("pip")}
      />

      {/* Language dropdown (placeholder) */}
      <Text
        text="Language:"
        style={LABEL_STYLE}
        x={colX + 400}
        y={firstRowY + rowSpacing * 4}
      />
      <RectButton
        width={140}
        height={32}
        x={colX + 620}
        y={firstRowY + rowSpacing * 4 - 2}
        text={settings.language}
        color={"#6b7280"}
        fontColor="white"
        callback={() => setLangDropdownOpen((s) => !s)}
      />

      {langDropdownOpen && (
        <>
          <RectButton
            width={140}
            height={32}
            x={colX + 620}
            y={firstRowY + rowSpacing * 4 + 36}
            text={"English"}
            color={settings.language === "English" ? "#10b981" : "#9ca3af"}
            fontColor="white"
            callback={() => {
              setSettings((prev) => ({ ...prev, language: "English" }));
              setLangDropdownOpen(false);
            }}
          />
          <RectButton
            width={140}
            height={32}
            x={colX + 620}
            y={firstRowY + rowSpacing * 4 + 76}
            text={"Spanish"}
            color={settings.language === "Spanish" ? "#10b981" : "#9ca3af"}
            fontColor="white"
            callback={() => {
              setSettings((prev) => ({ ...prev, language: "Spanish" }));
              setLangDropdownOpen(false);
            }}
          />
        </>
      )}

      {/* Close Button */}
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

export default GameSettings;
