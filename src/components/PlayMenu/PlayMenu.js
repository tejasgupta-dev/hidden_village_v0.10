import { useEffect, useState } from "react";
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import Background from "../Background"
import Button from "../Button";
import { red, yellow, purple, babyBlue, powderBlue, cornflowerBlue, steelBlue, dodgerBlue, royalBlue, white, black, green } from "../../utils/colors";
import { useMachine } from "@xstate/react";
import {PlayMenuMachine} from "./PlayMenuMachine";
import ConjectureModule , {getEditLevel, setEditLevel, getGoBackFromLevelEdit, setGoBackFromLevelEdit} from "../ConjectureModule/ConjectureModule";
import CurricularModule from "../CurricularModule/CurricularModule.js";
import ConjectureSelectorModule, { getAddToCurricular, setAddtoCurricular } from "../ConjectureSelector/ConjectureSelectorModule.js";
import CurricularSelectorModule, { getPlayGame, setPlayGame } from "../CurricularSelector/CurricularSelector.js";
import StoryEditorModule from "../StoryEditorModule/StoryEditorModule.js"; 
import { getCurrentUserContext, getUserOrgsFromDatabase, switchPrimaryOrganization, getOrganizationInfo } from "../../firebase/userDatabase";
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
import ClassManager from "../ClassManager/ClassManager";

const PlayMenu = (props) => {
    const {width, height, columnDimensions, rowDimensions, userName, role, organization, logoutCallback} = props;
    const [buttonList, setButtonList] = useState([]);
    const [distanceBetweenButtons, setDistanceBetweenButtons] = useState();
    const [startingX, setStartingX] = useState();
    const [state, send] = useMachine(PlayMenuMachine);
    const [userRole, setUserRole] = useState(role);
    const [isDataMenuVisable, setdataMenuVisable] = useState(false);
    const [studentOrgs, setStudentOrgs] = useState([]);
    const [currentOrgId, setCurrentOrgId] = useState(null);
    
    // Get Firebase app instance
    const firebaseApp = firebase.app();
    
    // Load student organizations for switching
    useEffect(() => {
        const loadStudentOrgs = async () => {
            if (userRole === "Student" && firebaseApp) {
                try {
                    const auth = firebaseApp.auth();
                    const user = auth.currentUser;
                    if (user) {
                        const userOrgs = await getUserOrgsFromDatabase(user.uid, firebaseApp);
                        const orgIds = Object.keys(userOrgs);
                        
                        if (orgIds.length >= 2) {
                            const orgList = [];
                            for (const orgId of orgIds) {
                                const orgInfo = await getOrganizationInfo(orgId, firebaseApp);
                                if (orgInfo) {
                                    orgList.push({
                                        id: orgId,
                                        name: orgInfo.name || 'Unknown Organization'
                                    });
                                }
                            }
                            setStudentOrgs(orgList);
                            
                            // Get current org
                            const { orgId } = await getCurrentUserContext(firebaseApp);
                            setCurrentOrgId(orgId);
                        }
                    }
                } catch (error) {
                    console.error('Error loading student organizations:', error);
                }
            }
        };
        loadStudentOrgs();
    }, [userRole, firebaseApp]);
    
    const handleSwitchOrganization = async (targetOrgId) => {
        try {
            const auth = firebaseApp.auth();
            const user = auth.currentUser;
            if (user) {
                await switchPrimaryOrganization(user.uid, targetOrgId, firebaseApp);
                // Reload page to refresh context
                window.location.reload();
            }
        } catch (error) {
            console.error('Error switching organization:', error);
            alert('Failed to switch organization: ' + error.message);
        }
    };
    
    // Update userRole when role prop changes
    useEffect(() => {
        console.log('PlayMenu: Role prop changed from', userRole, 'to', role);
        setUserRole(role);
    }, [role]);

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
        console.log('PlayMenu: Building button list for role:', role);
        let list = [];
        
        // Add safety check for undefined role
        if (!role) {
            console.warn('PlayMenu: User role is undefined, using default role');
            role = 'Student';
        }
        
        if(role === "Admin" || role === "Developer"){ // if user is not a student
            console.log('PlayMenu: Building Admin/Developer button list');
            list.push(
                {text: "ADMIN", callback: () => send("ADMIN"), color: babyBlue},
                {text: "NEW GAME", callback: () => send("NEWGAME"), color: purple},
                {text: "EDIT GAME", callback: () => (setPlayGame(false), send("GAMESELECT")), color: powderBlue},
                {text: "PLAY", callback: () => (setPlayGame(true), send("GAMESELECT")), color: royalBlue},
                {text: "NEW LEVEL", callback: () => (setEditLevel(true), send("NEWLEVEL")), color: dodgerBlue},
                {text: "EDIT LEVEL", callback: () => (setAddtoCurricular(false),send("LEVELSELECT")), color: steelBlue},
                {text: "SETTINGS", callback: () => send("SETTINGS"), color: cornflowerBlue},
            );
        } else if (role === "Student"){
            console.log('PlayMenu: Building Student button list');
            list.push(
                {text: "NEW GAME", callback: () => send("NEWGAME"), color: purple},
                {text: "EDIT GAME", callback: () => (setPlayGame(false), send("GAMESELECT")), color: powderBlue},
                {text: "PLAY", callback: () => (setPlayGame(true), send("GAMESELECT")), color: royalBlue},
                {text: "NEW LEVEL", callback: () => (setEditLevel(true), send("NEWLEVEL")), color: dodgerBlue},
                {text: "EDIT LEVEL", callback: () => (setAddtoCurricular(false),send("LEVELSELECT")), color: steelBlue},
                {text: "SETTINGS", callback: () => send("SETTINGS"), color: cornflowerBlue}
            );
        } else if (role === "Teacher"){
            console.log('PlayMenu: Building Teacher button list');
            list.push(
                {text: "ADMIN", callback: () => send("ADMIN"), color: babyBlue},
                {text: "NEW GAME", callback: () => send("NEWGAME"), color: purple},
                {text: "EDIT GAME", callback: () => (setPlayGame(false), send("GAMESELECT")), color: powderBlue},
                {text: "PLAY", callback: () => (setPlayGame(true), send("GAMESELECT")), color: royalBlue},
                {text: "NEW LEVEL", callback: () => (setEditLevel(true), send("NEWLEVEL")), color: dodgerBlue},
                {text: "EDIT LEVEL", callback: () => (setAddtoCurricular(false),send("LEVELSELECT")), color: steelBlue},
                {text: "SETTINGS", callback: () => send("SETTINGS"), color: cornflowerBlue},
            );
        }
        console.log('PlayMenu: Final button list:', list.length, 'buttons for role:', role);
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
          
          {/* Student Organization Switch Button */}
          {userRole === "Student" && studentOrgs.length >= 2 && (
            <>
              {studentOrgs.map((org, idx) => {
                if (org.id === currentOrgId) return null; // Don't show current org as button
                return (
                  <Button
                    key={org.id}
                    height={height * 0.03}
                    width={width * 0.15}
                    x={width * 0.1}
                    y={height * 0.21 + (idx * height * 0.04)}
                    color={yellow}
                    fontSize={12}
                    fontColor={black}
                    text={`SWITCH TO: ${org.name}`}
                    fontWeight={600}
                    callback={() => handleSwitchOrganization(org.id)}
                  />
                );
              })}
            </>
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
        {state.value === "main" && (userRole === "Admin" || userRole === "Developer") && ( // if the state is main, show the data button and the data menu (only for Admin/Developer)
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
            onOrganizationsClick={() => send("ORGANIZATIONS")} // goes to Organizations
            onClassesClick={() => send("CLASSES")} // goes to Classes
        />
        )}
        {state.value === "invites" && (
            <InviteManagementModule
            width={width}
            height={height}
            firebaseApp={firebaseApp}
            onBack={() => send("ORGANIZATIONS")} // goes to Organization Manager
        />
        )}
        {state.value === "classes" && (
            <ClassManager
                width={width}
                height={height}
                firebaseApp={firebaseApp}
                mainCallback={() => send("ADMIN")}
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
            firebaseApp={firebaseApp}
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
            mainCallback={() => send("ADMIN")}
            onInvitesClick={() => send("INVITES")}
          />
        )}
        
        </>
    );
};

export default PlayMenu;