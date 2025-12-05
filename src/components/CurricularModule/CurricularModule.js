import React, { useState } from 'react';
import Background from "../Background";
import { blue, white, red, green, indigo, hotPink, purple } from "../../utils/colors";
import Button from "../Button";
import RectButton from "../RectButton";
// Import necessary Firebase functions
import { getDatabase, ref, get, update } from "firebase/database";
import { getAuth } from "firebase/auth"; // Import getAuth
import { getConjectureDataByUUIDWithCurrentOrg, deleteFromDatabaseCurricularWithCurrentOrg, loadGameDialoguesFromFirebaseWithCurrentOrg, saveGameWithCurrentOrg } from "../../firebase/database";
import { CurricularContentEditor } from "../CurricularModule/CurricularModuleBoxes";
import { setAddtoCurricular } from '../ConjectureSelector/ConjectureSelectorModule';
import Settings from '../Settings';
import GameSettings from "../GameSettings";
import PoseAuthoring from "../PoseAuth/PoseAuthoring";

//Import uuid library
import { v4 as uuidv4 } from "uuid";

// stores a list of conjectures
export const Curriculum = {
  CurrentConjectures: [],
  CurrentUUID: null, // null if using new game. Same UUID from database if editing existing game.

  addConjecture(conjecture) { // add the entire conjecture object to a list
    this.CurrentConjectures.push(conjecture);
  },

  getCurrentConjectures() { // return the game (list of conjectures)
    return this.CurrentConjectures;
  },

  getConjecturebyIndex(index) { // return a specific conjecture
    return this.CurrentConjectures[index];
  },

  getCurrentUUID() { //return the UUID if editing an existing game
    if (this.CurrentUUID != null && this.CurrentUUID != "") {
      return this.CurrentUUID;
    }
    else {
      return null;
    }
  },

  setCurrentUUID(newUUID) {
    this.CurrentUUID = newUUID;
  },

  moveConjectureUpByIndex(index) { // swaps 2 elements so the index rises up the list
    if (index > 0) {
      const temp = this.CurrentConjectures[index - 1];
      this.CurrentConjectures[index - 1] = this.CurrentConjectures[index];
      this.CurrentConjectures[index] = temp;
    }
  },

  moveConjectureDownByIndex(index) { // swaps 2 elements so the index falls down the list
    if (index < this.CurrentConjectures.length - 1) {
      const temp = this.CurrentConjectures[index + 1];
      this.CurrentConjectures[index + 1] = this.CurrentConjectures[index];
      this.CurrentConjectures[index] = temp;
    }
  },

  removeConjectureByIndex(index) { // remove a particular conjecture based on its index in the list
    this.CurrentConjectures.splice(index, 1);;
  },

  async setCurricularEditor(curricular, showPublic = true) { // fill in curriculum data
    console.log('Curriculum: setCurricularEditor called with:', curricular, 'showPublic:', showPublic);
    this.CurrentConjectures = []; // remove previous list of levels
    
    // Check for both old and new field names for backward compatibility
    const levelIds = curricular["levelIds"] || curricular["ConjectureUUIDs"];
    
    if (levelIds && levelIds.length > 0) { // only fill in existing values
      console.log('Curriculum: Loading conjectures for UUIDs:', levelIds);
      for (let i = 0; i < levelIds.length; i++) {
        console.log(`Curriculum: Loading conjecture ${i + 1}/${levelIds.length}:`, levelIds[i]);
        try {
          // Pass showPublic to control whether to load public levels from other orgs
          // Pass forceLoadPrivate=true to load private levels that are already in the game's level list
          const conjectureList = await getConjectureDataByUUIDWithCurrentOrg(levelIds[i], showPublic, true);
          if (conjectureList && conjectureList[levelIds[i]]) {
            const conjecture = conjectureList[levelIds[i]];
            console.log(`Curriculum: Loaded conjecture ${i + 1}:`, conjecture);
            this.CurrentConjectures.push(conjecture);
          } else {
            console.warn(`Curriculum: Conjecture ${levelIds[i]} not found or could not be loaded`);
          }
        } catch (error) {
          console.error(`Curriculum: Error loading conjecture ${levelIds[i]}:`, error);
          // Continue loading other conjectures even if one fails
        }
      }
      console.log('Curriculum: Total conjectures loaded:', this.CurrentConjectures.length);
    } else {
      console.log('Curriculum: No levelIds or ConjectureUUIDs found in curricular data');
    }
    
    console.log('Curriculum: Setting localStorage values...');
    // Use new field names from the database structure
    localStorage.setItem('CurricularName', curricular["name"] || curricular["CurricularName"]);
    localStorage.setItem('CurricularAuthor', curricular["author"] || curricular["CurricularAuthor"]);
    localStorage.setItem('CurricularKeywords', curricular["keywords"] || curricular["CurricularKeywords"]);
    const pinValue = curricular["pin"] || curricular["CurricularPIN"];
    if (pinValue != "undefined" && pinValue != null) {
      localStorage.setItem('CurricularPIN', pinValue);
    }
    // Load isPublic flag (default to false)
    const isPublicValue = curricular["isPublic"] || false;
    localStorage.setItem('GameIsPublic', isPublicValue ? 'true' : 'false');
    
    // Save organization info to prevent editing games from other orgs
    if (curricular._isFromOtherOrg === true) {
      localStorage.setItem('Game_isFromOtherOrg', 'true');
      if (curricular._sourceOrgId) {
        localStorage.setItem('Game_sourceOrgId', curricular._sourceOrgId);
      }
      console.log('Curriculum: Game is from another organization, saved org info');
    } else {
      localStorage.removeItem('Game_isFromOtherOrg');
      localStorage.removeItem('Game_sourceOrgId');
      console.log('Curriculum: Game is from current organization');
    }
    
    console.log('Curriculum: localStorage values set:', {
      name: curricular["name"] || curricular["CurricularName"],
      author: curricular["author"] || curricular["CurricularAuthor"],
      keywords: curricular["keywords"] || curricular["CurricularKeywords"],
      pin: curricular["pin"] || curricular["CurricularPIN"]
    });
  },

  clearCurriculum() {
    this.CurrentConjectures = []; // remove previous list of levels
    this.setCurrentUUID(null); // remove UUID
  },
};

const CurricularModule = (props) => {
  const { height, width, userName, mainCallback, conjectureCallback, conjectureSelectCallback, storyEditorCallback } = props;
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [timer, setTimer] = useState(5); // default timer value

  const resetCurricularValues = () => {
    localStorage.removeItem('CurricularName');
    localStorage.removeItem('CurricularAuthor');
    localStorage.removeItem('CurricularKeywords');
    localStorage.removeItem('CurricularPIN');
    localStorage.removeItem('GameIsPublic');
    localStorage.removeItem('Game_isFromOtherOrg');
    localStorage.removeItem('Game_sourceOrgId');
    Curriculum.clearCurriculum();
  };

  const enhancedMainCallback = () => {
    resetCurricularValues();
    mainCallback();
  };

  const deleteCurrentCurricular = async (currentUUID) => {
    if (!currentUUID) {
      alert("No game to delete.");
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this entire game? This action cannot be undone."
    );

    if (confirmDelete) {
      try {
        // Also remove the game from the gameNames index
        const gameName = localStorage.getItem('CurricularName');
        const db = getDatabase();
        const updates = {};
        updates[`/Game/${currentUUID}`] = null; // Delete game data
        if (gameName) {
          updates[`/gameNames/${gameName.trim()}`] = null; // Delete name from index
        }
        await update(ref(db), updates);

        enhancedMainCallback();
      } catch (error) {
        console.error('Error during deletion:', error);
        alert("Failed to delete game. Please try again.");
        enhancedMainCallback();
      }
    }
  };


  return (
    <>
      {!showSettingsMenu && (
        <>
          <Background height={height} width={width} />
          <CurricularContentEditor height={height} width={width} userName={userName} conjectureCallback={conjectureCallback}/>

          {/* Buttons */}
          <RectButton
            height={height * 0.13}
            width={width * 0.5}
            x={width * 0.1}
            y={height * 0.23}
            color={red}
            fontSize={width * 0.013}
            fontColor={white}
            text={"SET GAME OPTIONS"}
            fontWeight={800}
            callback={() => setShowSettingsMenu(true)}
          />
          <RectButton
            height={height * 0.13}
            width={width * 0.5}
            x={width * 0.4}
            y={height * 0.23}
            color={hotPink}
            fontSize={width * 0.013}
            fontColor={white}
            text={"STORY EDITOR"}
            fontWeight={800}
            callback={() => {
              if (!Curriculum.getCurrentUUID()) {
                const newId = uuidv4();
                Curriculum.setCurrentUUID(newId);
              }
              if (storyEditorCallback) {
                const currentUUID = Curriculum.getCurrentUUID();
                storyEditorCallback(currentUUID);
              } else {
                console.error("Error: storyEditorCallback is undefined!");
              }
            }}
          />
          <RectButton
            height={height * 0.13}
            width={width * 0.5}
            x={width * 0.7}
            y={height * 0.23}
            color={purple}
            fontSize={width * 0.013}
            fontColor={white}
            text={"INSTRUCTIONS"}
            fontWeight={800}
            callback={() =>
              alert(
                "Click +Add Level to add a level to the game.\nPress Save Draft to save an incomplete game.\nPress Publish to save a completed game."
              )
            }
          />
          <RectButton
            height={height * 0.13}
            width={width * 0.26}
            x={width * 0.85}
            y={height * 0.93}
            color={red}
            fontSize={width * 0.013}
            fontColor={white}
            text={"BACK"}
            fontWeight={800}
            callback={() => {
              const confirmBack = window.confirm("The game hasnt been saved. Are you sure you want to go back?");
              if (confirmBack) {
                enhancedMainCallback();
              }
            }}
          />
          <RectButton
            height={height * 0.13}
            width={width * 0.45}
            x={width * 0.275}
            y={height * 0.93}
            color={indigo}
            fontSize={width * 0.014}
            fontColor={white}
            text={"+ADD LEVEL"}
            fontWeight={800}
            callback={() => {
              setAddtoCurricular(true);
              conjectureSelectCallback();
            }}
          />
          <RectButton
            height={height * 0.13}
            width={width * 0.26}
            x={width * 0.46}
            y={height * 0.93}
            color={green}
            fontSize={width * 0.013}
            fontColor={white}
            text={"SAVE DRAFT"}
            fontWeight={800}
            callback={async () => {
              const success = await saveGameWithCurrentOrg(Curriculum.getCurrentUUID(), false);
              if (success) {
                enhancedMainCallback();
              }
            }}
          />
          <RectButton
            height={height * 0.13}
            width={width * 0.26}
            x={width * 0.57}
            y={height * 0.93}
            color={green}
            fontSize={width * 0.015}
            fontColor={white}
            text={"PUBLISH"}
            fontWeight={800}
            callback={async () => {
              const success = await saveGameWithCurrentOrg(Curriculum.getCurrentUUID(), true);
              if (success) {
                enhancedMainCallback();
              }
            }}
          />
          <RectButton
            height={height * 0.13}
            width={width * 0.26}
            x={width * 0.73}
            y={height * 0.93}
            color={red}
            fontSize={width * 0.013}
            fontColor={white}
            text={"DELETE"}
            fontWeight={800}
            callback={() => deleteCurrentCurricular(Curriculum.getCurrentUUID())}
          />
        </>
      )}

      {showSettingsMenu && (
        <GameSettings
          width={width * 0.6}
          height={height * 0.6}
          x={width * 0.18}
          y={height * 0.17}
          onClose={() => setShowSettingsMenu(false)}
        />
      )}
    </>
  );
};

export default CurricularModule;
