import { Container, Text } from "@inlet/react-pixi";
import RectButton from "./RectButton";

export default function SettingRow({
  label,
  value,
  x,
  y,
  onToggle,
  buttonX = 260, // space between label & toggle
  buttonW = 96,  // wider pill
  disabled = false, // disabled state
}) {
  const isDisabled = disabled;
  const labelColor = isDisabled ? 0x9ca3af : 0x1f2937; // gray-400 when disabled, slate-800 when enabled
  const buttonColor = isDisabled ? "#6b7280" : (value ? "#2563eb" : "#9ca3af"); // gray-500 when disabled
  const alpha = isDisabled ? 0.6 : 1;
  const callback = isDisabled ? undefined : onToggle;

  return (
    <Container position={[x, y]}>
      <Text
        text={label}
        style={{
          fontFamily: "Arial",
          fontSize: 16,
          fontWeight: "600",
          fill: labelColor,
          letterSpacing: 0.5,
        }}
      />
      <RectButton
        width={buttonW}
        height={32}
        x={buttonX}
        y={-2}                // slight visual centering
        text={value ? "ON" : "OFF"}
        color={buttonColor}
        fontColor="white"
        callback={callback}
        alpha={alpha}
      />
    </Container>
  );
}
