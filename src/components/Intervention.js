import { Graphics, Text } from "@inlet/react-pixi";
import { darkGray, white } from "../utils/colors.js";
import { useEffect, useCallback } from "react";

const Intervention = (props) => {
  const { triggerNextChapter, width, height } = props;
  const drawModalBackground = useCallback((g) => {
    g.beginFill(darkGray, 0.9);
    g.drawRect(0, 0, width, height);
    g.endFill();
  }, [width, height]);

  const handleUserKeyPress = useCallback((event) => {
    const { _, keyCode } = event;
    // keyCode 78 is n
    if (keyCode === 78) {
      triggerNextChapter();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleUserKeyPress);
    return () => {
      window.removeEventListener("keydown", handleUserKeyPress);
    };
  }, [handleUserKeyPress]);
  return (
    <>
      <Graphics draw={drawModalBackground} />
      <Text
        text={"Quick break!"}
        y={height * 0.5}
        x={width * 0.4}
        style={
          new PIXI.TextStyle({
            align: "center",
            fontFamily: "Futura",
            fontSize: "5em",
            fontWeight: 800,
            fill: [white],
          })
        }
      />
    </>
  );
};
export default Intervention;
