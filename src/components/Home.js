import Background from "./Background";
import Button from "./Button";
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { yellow, blue, green, white, red,turquoise } from "../utils/colors";

const Home = (props) => {
  const { height, width, userName, startCallback, logoutCallback } = props;

  return (
    <>
      <Background height={height} width={width} />
      <Button
        height={height * 0.5}
        width={width * 0.33}
        x={width * 0.5}
        y={height * 0.7}
        color={blue}
        fontSize={width * 0.075}
        fontColor={yellow}
        text={"START"}
        fontWeight={800}
        callback={startCallback}
      />
      <Button
        height={height * 0.01}
        width={width * 0.05}
        x={width * 0.05}
        y={height * 0.1}
        color={red}
        fontSize={width * 0.009}
        fontColor={white}
        text={"LOG OUT"}
        fontWeight={800}
        callback={logoutCallback}
      />
      <Text
        text={"Hidden Village"}
        x={width * 0.5}
        y={height * 0.25}
        style={
          new TextStyle({
            align: "center",
            fontFamily: "Futura",
            fontSize: width * 0.091,
            fontWeight: 800,
            fill: [blue],
            letterSpacing: -5,
          })
        }
        anchor={0.5}
      />
      <Text
        text={`Playing as: ${userName}`}
        x={width * 0.5}
        y={height * 0.05}
        style={
          new TextStyle({
            align: "center",
            fontFamily: "Futura",
            fontSize: width * 0.0125,
            fontWeight: 800,
            fill: [blue],
            letterSpacing: 0,
          })
        }
        anchor={0.5}
      />
    </>
  );
};

export default Home;
