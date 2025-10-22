import { useEffect, useState } from "react";
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import Background from "../Background"
import Button from "../Button";
import { red, yellow, purple, babyBlue, powderBlue, cornflowerBlue, steelBlue, dodgerBlue, royalBlue, white, black } from "../../utils/colors";
import { useMachine } from "@xstate/react";
import {PlayMenuMachine} from "./PlayMenuMachine";
import ConjectureModule , {getEditLevel, setEditLevel, getGoBackFromLevelEdit, setGoBackFromLevelEdit} from "../ConjectureModule/ConjectureModule";
import CurricularModule from "../CurricularModule/CurricularModule.js";
import ConjectureSelectorModule, { getAddToCurricular, setAddtoCurricular } from "../ConjectureSelector/ConjectureSelectorModule.js";
import CurricularSelectorModule, { getPlayGame, setPlayGame } from "../CurricularSelector/CurricularSelector.js";
import StoryEditorModule from "../StoryEditorModule/StoryEditorModule.js"; 
import { getCurrentUserContext } from "../../firebase/userDatabase";
import firebase from "firebase/compat";
import { Curriculum } from "../CurricularModule/CurricularModule.js";
import Settings from "../Settings";
import UserManagementModule from "../AdminHomeModule/UserManagementModule";
import NewUserModule from "../AdminHomeModule/NewUserModule";
import InviteManagementModule from "../AdminHomeModule/InviteManagementModule";
import PoseAuthoring from "../PoseAuth/PoseAuthoring";
import PlayGame from "../PlayGameModule/PlayGame";
import PoseTest from "../ConjectureModule/PoseTest";
import DataMenu from "./DataMenu.js";
import OrganizationManager from "../OrganizationManager/OrganizationManager";

const PlayMenu = (props) => {
    const {width, height, columnDimensions, rowDimensions, userName, role, organization, logoutCallback} = props;
    const [buttonList, setButtonList] = useState([]);
    const [distanceBetweenButtons, setDistanceBetweenButtons] = useState();
    const [startingX, setStartingX] = useState();
    const [state, send] = useMachine(PlayMenuMachine);
    const [userRole, setUserRole] = useState(role);
    const [isDataMenuVisable, setdataMenuVisable] = useState(false);
    
    // Get Firebase app instance
    const firebaseApp = firebase.app();
    
    useEffect(() => {
        // Calculate the distance for buttons
        const totalAvailableWidth = width * 0.9;
        const startingX = (width * 0.5) - (totalAvailableWidth * 0.5);
        setStartingX(startingX);
        const spaceInBetween = totalAvailableWidth / (buttonList.length-1);
        setDistanceBetweenButtons(spaceInBetween);

    }, [buttonList, width, height]);
    
    useEffect(() => {
        let role = userRole;
        console.log('Building button list for role:', role);
        let list = [];
        
        // Add safety check for undefined role
        if (!role) {
            console.warn('User role is undefined, using default role');
            role = 'Student';
        }
        
        if(role === "Admin" || role === "Developer"){ // if user is not a student
            list.push(
                {text: "ADMIN", callback: () => send("ADMIN"), color: babyBlue},
                {text: "ORGANIZATIONS", callback: () => send("ORGANIZATIONS"), color: yellow},
                {text: "INVITES", callback: () => send("INVITES"), color: red},
                {text: "NEW GAME", callback: () => send("NEWGAME"), color: purple},
                {text: "EDIT GAME", callback: () => (setPlayGame(false), send("GAMESELECT")), color: powderBlue},
                {text: "PLAY", callback: () => (setPlayGame(true), send("GAMESELECT")), color: royalBlue},
                {text: "NEW LEVEL", callback: () => (setEditLevel(true), send("NEWLEVEL")), color: dodgerBlue},
                {text: "EDIT LEVEL", callback: () => (setAddtoCurricular(false),send("LEVELSELECT")), color: steelBlue},
                {text: "SETTINGS", callback: () => send("SETTINGS"), color: cornflowerBlue},
            );
        } else if (role === "Student"){
            list.push({text: "Play", callback: () => (setPlayGame(true), send("GAMESELECT")), color: royalBlue}, {text: "Settings", callback: () => send("SETTINGS"), color: cornflowerBlue})
        } else if (role === "Teacher"){
            list.push(
                {text: "ORGANIZATIONS", callback: () => {
                    console.log('ORGANIZATIONS button clicked (Teacher)!');
                    console.log('Setting isOrganizationManagerVisible to true');
                    setIsOrganizationManagerVisible(true);
                }, color: yellow},
                {text: "NEW GAME", callback: () => send("NEWGAME"), color: purple},
                {text: "EDIT GAME", callback: () => (setPlayGame(false), send("GAMESELECT")), color: powderBlue},
                {text: "PLAY", callback: () => send("PLAY"), color: royalBlue},
                {text: "NEW LEVEL", callback: () => (setEditLevel(true), send("NEWLEVEL")), color: dodgerBlue},
                {text: "EDIT LEVEL", callback: () => (setAddtoCurricular(false),send("LEVELSELECT")), color: steelBlue},
                {text: "SETTINGS", callback: () => send("SETTINGS"), color: cornflowerBlue},
            );
        }
        console.log('Final button list:', list);
        setButtonList(list);
    }, [userRole]);

    return (
        <>
        {state.value === "main" && ( // if the state is main, show the log out button and background
          <>
            <Background height={height} width= {width}/>
            <Button
            height={height * 0.01}
            width={width * 0.05}
            x={width * 0.05}
            y={height * 0.1}
            color={red}
            fontSize={14}
            fontColor={white}
            text={"LOG OUT"}
            fontWeight={800}
            callback={logoutCallback}
          />
          
          {/* User and Organization Info */}
          <Text
            text={`Welcome, ${userName || 'User'} (${role || 'Unknown'})`}
            x={width * 0.1}
            y={height * 0.15}
            style={new TextStyle({
              align: "left",
              fontFamily: "Arial",
              fontSize: 16,
              fontWeight: "bold",
              fill: [white],
            })}
          />
          
          {organization && (
            <Text
              text={`Organization: ${organization}`}
              x={width * 0.1}
              y={height * 0.18}
              style={new TextStyle({
                align: "left",
                fontFamily: "Arial",
                fontSize: 14,
                fontWeight: "normal",
                fill: [white],
              })}
            />
          )}
        </>
        )}
        {state.value === "main" && buttonList.map((button, idx) => { //if the state is main, show the buttons
            console.log(`Rendering button ${idx}:`, button.text, 'color:', button.color);
            
            // Skip rendering if button text is empty or undefined
            if (!button.text) {
                console.warn(`Skipping button ${idx} with empty text:`, button);
                return null;
            }
            
            return (
                <Button
                    fontColor={button.color === yellow ? black : yellow}
                    key = {idx}
                    width = {width * 0.12}
                    color = {button.color}
                    fontSize = {width * 0.02}
                    fontWeight = {600}
                    text={button.text}
                    x={startingX + (idx * distanceBetweenButtons)}
                    y={height * 0.5}
                    callback={button.callback}
                />
            );
        })}
        {state.value === "main" && ( // if the state is main, show the data button and the data menu
          <>
          <Button
            height={height * 0.01}
            width={width * 0.05}
            x={width - (width * 0.05)}
            y={height - (height * 0.1)}
            color={red}
            fontSize={14}
            fontColor={white}
            text={"DATA"}
            fontWeight={800}
            callback={() => setdataMenuVisable(!isDataMenuVisable)}
          />
          <DataMenu 
            trigger={isDataMenuVisable} 
            menuWidth={width * 0.4}
            menuHeight={height * 0.5}
            x={width * 0.5 - (width * 0.4 * 0.5)}
            y={height * 0.5 - (height * 0.5 * 0.5)}
            onClose={() => setdataMenuVisable(false)}
          />
        </>
        )}
        {state.value === "test" && ( //if the state is test, show the test module
          <PoseTest
            width={width}
            height={height}
            columnDimensions={columnDimensions}
            rowDimensions={rowDimensions}
            conjectureCallback={() => send("NEWLEVEL")}
            gameID={Curriculum.getCurrentUUID()}
          />
        )}
        {state.value === "newLevel" && ( //if the state is newLevel, show the Conjecture Module
            <ConjectureModule
                width={width}
                height={height}
                columnDimensions={columnDimensions}
                rowDimensions={rowDimensions}
                userName={userName}
                editCallback={() => send("EDIT")}
                // getGoBackFromLevelEdit should be "MAIN", "LEVELSELECT", or "NEWGAME"
                backCallback={() => send(getGoBackFromLevelEdit())}
                testCallback={() => send("TEST")}
            />
        )}
        {state.value === "edit" && ( //if the state is edit, show the Conjecture Module
            <PoseAuthoring
            width={width}
            height={height}
            columnDimensions={columnDimensions}
            rowDimensions={rowDimensions}
            conjectureCallback={() => send("NEWLEVEL")}  // goes to the Conjecture Module
          />
        )
        }
        {state.value === "play" && (
            <PlayGame
                width={width}
                height={height}
                backCallback={()=> send("MAIN")}
                columnDimensions={columnDimensions}
                rowDimensions={rowDimensions}
                gameUUID={Curriculum.getCurrentUUID()}
            /> 
        )}
        {state.value === "settings" && (
            <Settings
                width={width/1.2}
                height={height/1.2}
                x = {width * 0.1}
                y = {height * 0.1}
                onClose={() => send("MAIN")}
            />
        )}
        {state.value === "admin" && (
            <UserManagementModule
            width={width}
            height={height}
            firebaseApp={firebaseApp}
            mainCallback={() => send("MAIN")} // goes to Home
            addNewUserCallback={() => send("ADDNEWUSER")} // goes to add new user section
        />
        )}
        {state.value === "invites" && (
            <InviteManagementModule
            width={width}
            height={height}
            firebaseApp={firebaseApp}
            onBack={() => send("MAIN")} // goes to Home
        />
        )}
        {state.value === "addNewUser" && (
            <NewUserModule  
            width={width}
            height={height}
            UserManagementCallback={() => {
              send("ADMIN");
              }}// goes to user management
        />
        )}
        {state.value === "newGame" && (
          <CurricularModule
            width={width}
            height={height}
            columnDimensions={columnDimensions}
            rowDimensions={rowDimensions}
            userName={userName}
            mainCallback={() => send("MAIN")} // goes to Home
            conjectureSelectCallback={() => send("LEVELSELECT")}
            conjectureCallback={() => send("NEWLEVEL")}  // preview a level in the game editor
            storyEditorCallback={() => {

              console.log("Sending STORYEDITOR...");
              send("STORYEDITOR")}
            }
          />
        )}
        {state.value === "storyEditor" && (
          console.log("Entered storyEditor state"),
          <StoryEditorModule
            width={width}
            height={height}
            mainCallback={() => send("MAIN")}
            curricularCallback={() => send("NEWGAME")}
            gameUUID={Curriculum.getCurrentUUID()}
          />
        )}
        {state.value === "levelSelect" && (
          <ConjectureSelectorModule
            width={width}
            height={height}
            columnDimensions={columnDimensions}
            rowDimensions={rowDimensions}
            conjectureCallback={() => send("NEWLEVEL")} // goes to the Conjecture Module
            curricularCallback={() => send("NEWGAME")}
            backCallback={() => {
              if(getAddToCurricular()) // if selecting a level to add to a game, go back to the game screen
                send("NEWGAME");
              else
                send("MAIN") // if selecting a level to edit, go to main menu
            }}
          />
        )}
        {state.value === "gameSelect" && (
          <CurricularSelectorModule
            width={width}
            height={height}
            columnDimensions={columnDimensions}
            rowDimensions={rowDimensions}
            userRole={userRole}
            curricularCallback={() => {
              if (!getPlayGame()) // edit game
                send("NEWGAME");
              else
                send("PLAY");
            }}
            mainCallback={() => {send("MAIN")}}
          />
        )}
        
        {/* Organization Manager */}
        {state.value === "organizations" && (
          <OrganizationManager
            width={width}
            height={height}
            firebaseApp={firebaseApp}
            mainCallback={() => send("MAIN")}
          />
        )}
        
        </>
    );
};

export default PlayMenu;