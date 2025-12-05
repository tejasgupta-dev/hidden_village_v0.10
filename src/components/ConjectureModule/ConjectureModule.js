import Background from "../Background";
import React, { useState, useEffect } from 'react';
import { powderBlue, skyBlue, cornflowerBlue, green, neonGreen, black, blue, white, pink, orange, red, transparent, turquoise } from "../../utils/colors";
import Button from "../Button";
import RectButton from "../RectButton";
import InputBox from "../InputBox";
import { ConjectureBox, KeywordsBox, NameBox, PINBox, PublicCheckbox } from "./ConjectureModuleBoxes";
import { EndBox, IntermediateBox, StartBox } from "../PoseAuth/PoseAuthoringBoxes";
import { writeToDatabaseConjectureWithCurrentOrg, writeToDatabaseConjectureDraftWithCurrentOrg, keysToPush, searchConjecturesByWordWithCurrentOrg, deleteFromDatabaseConjectureWithCurrentOrg} from "../../firebase/database";
import { useMachine } from "@xstate/react";
import { ConjectureEditorMachine } from "../../machines/conjectureEditorMachine";

let editLevel = true;
export function setEditLevel(trueOrFalse){
  editLevel = trueOrFalse;
}
export function getEditLevel(){
  return editLevel;
}

let goBack = "MAIN"; // TODO: add more states; reference playMenu.js
export function setGoBackFromLevelEdit(previous){
  goBack = previous;
}
export function getGoBackFromLevelEdit(){
  return goBack;
}

export const currentConjecture = {
  CurrentConjecture: [],
  CurrentUUID: [],

  setConjecture(conjecture) {
    console.log('currentConjecture: setConjecture called with:', conjecture);
    this.CurrentConjecture = conjecture;
    console.log('currentConjecture: CurrentConjecture set to:', this.CurrentConjecture);
  },

  getCurrentConjecture() {
    console.log('currentConjecture: getCurrentConjecture called, returning:', this.CurrentConjecture);
    return this.CurrentConjecture;
  },

  setCurrentUUID(UUID){
    console.log('currentConjecture: setCurrentUUID called with:', UUID);
    this.CurrentUUID = UUID;
    console.log('currentConjecture: CurrentUUID set to:', this.CurrentUUID);
  },

  getCurrentUUID(){
    if(this.CurrentUUID != null && this.CurrentUUID != ""){
      console.log('currentConjecture: getCurrentUUID returning:', this.CurrentUUID);
      return this.CurrentUUID;
    }
    else{
      console.log('currentConjecture: getCurrentUUID returning null (CurrentUUID is:', this.CurrentUUID, ')');
      return null;
    }
  },

  clearConjecture(){
    console.log('currentConjecture: clearConjecture called');
    this.setConjecture(null); // remove previous list of levels
    this.setCurrentUUID(null); // remove UUID
    console.log('currentConjecture: cleared');
  },
}

  // Reset Function
  const resetConjectureValues = () => {
  // clear everything we cached during conjecture editing
  keysToPush.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem('start.json');
  localStorage.removeItem('intermediate.json');
  localStorage.removeItem('end.json');
  localStorage.removeItem('Start Tolerance');
  localStorage.removeItem('Intermediate Tolerance');
  localStorage.removeItem('End Tolerance');
  localStorage.removeItem('_isFromOtherOrg');
  localStorage.removeItem('_sourceOrgId');
};

// fill in local storage using currentConjecture if an existing conjecture is selected
// currentConjecture receives the value when the conjecture is clicked from ConjectureSelectorModule
function setLocalStorage(){ 
      console.log('setLocalStorage: Starting to set localStorage from currentConjecture');
      const conj = currentConjecture.getCurrentConjecture() ?? {};
      console.log('setLocalStorage: Current conjecture data:', conj);

      if (!localStorage.getItem('Correct Answer')) {
        localStorage.setItem('Correct Answer', 'A');
        console.log('setLocalStorage: Set default Correct Answer to A');
      }

      if (Object.keys(conj).length === 0) {
        console.log('setLocalStorage: No conjecture data found, skipping localStorage setup');
        return;
      }

      console.log('setLocalStorage: Setting text box values...');
  // 1. Text-box values
  keysToPush.forEach((k) => {
    if (k === 'PIN' && !getEditLevel()) {
      localStorage.removeItem(k); // Make sure PIN is not in localStorage during preview
      console.log(`setLocalStorage: Removed PIN from localStorage (preview mode)`);
      return;
    }

    const val = conj['Text Boxes']?.[k];
    if (val !== undefined && val !== null && val !== '') {
      localStorage.setItem(k, val);
      console.log(`setLocalStorage: Set ${k} = "${val}"`);
    } else {
      localStorage.removeItem(k);          // ← no bogus "undefined"
      console.log(`setLocalStorage: Removed ${k} (value was: ${val})`);
    }
  });

  console.log('setLocalStorage: Setting pose data...');
  // 2. Pose JSON
  const poseKeys = [
    ['Start Pose',        'start.json'],
    ['Intermediate Pose', 'intermediate.json'],
    ['End Pose',          'end.json'],
  ];
  poseKeys.forEach(([dbKey, lsKey]) => {
    const pose = conj[dbKey]?.poseData;
    if (pose) {
      localStorage.setItem(lsKey, pose);
      console.log(`setLocalStorage: Set ${lsKey} with pose data`);
    } else {
      localStorage.removeItem(lsKey);
      console.log(`setLocalStorage: Removed ${lsKey} (no pose data)`);
    }
  });

  console.log('setLocalStorage: Setting tolerance values...');
  // 3. Tolerance
  const toleranceKeys = [
    ['Start Pose',        'Start Tolerance'],
    ['Intermediate Pose', 'Intermediate Tolerance'],
    ['End Pose',          'End Tolerance'],
  ];
  toleranceKeys.forEach(([dbKey, lsKey]) => {
    const tol = conj[dbKey]?.tolerance;
    if (tol !== undefined && tol !== null && tol !== '') {
      localStorage.setItem(lsKey, tol);
      console.log(`setLocalStorage: Set ${lsKey} = ${tol}`);
    } else {
      localStorage.removeItem(lsKey);
      console.log(`setLocalStorage: Removed ${lsKey} (value was: ${tol})`);
    }
  });

  console.log('setLocalStorage: Setting UUID and cleaning up...');
  // 4. Remember UUID (needed when the user hits SAVE/PUBLISH)
  currentConjecture.CurrentUUID = conj.UUID ?? null;
  currentConjecture.CurrentConjecture = null;   // avoid re-entrancy
  console.log(`setLocalStorage: Set CurrentUUID to ${currentConjecture.CurrentUUID}`);

  // 5. Save organization info to prevent editing levels from other orgs
  if (conj._isFromOtherOrg === true) {
    localStorage.setItem('_isFromOtherOrg', 'true');
    if (conj._sourceOrgId) {
      localStorage.setItem('_sourceOrgId', conj._sourceOrgId);
    }
    console.log('setLocalStorage: Level is from another organization, saved org info');
  } else {
    localStorage.removeItem('_isFromOtherOrg');
    localStorage.removeItem('_sourceOrgId');
    console.log('setLocalStorage: Level is from current organization');
  }

  // 6. Default correct answer
  if (!localStorage.getItem('Correct Answer')) {
    localStorage.setItem('Correct Answer', 'A');
    console.log('setLocalStorage: Set default Correct Answer to A');
  }
  
  console.log('setLocalStorage: Completed localStorage setup');
 }

const ConjectureModule = (props) => {
  const { height, width, columnDimensions, rowDimensions, userName, editCallback, backCallback, testCallback } = props;

  const [state, send] = useMachine(ConjectureEditorMachine);
  const [isSaved, setIsSaved] = useState(false);
  // Add local state to force re-renders when correct answer changes
  const [correctAnswer, setCorrectAnswer] = useState(localStorage.getItem('Correct Answer') || 'A');
  
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { 
    setLocalStorage();
    setCorrectAnswer(localStorage.getItem('Correct Answer') || 'A');
    setLoaded(true); 
  }, []);
  if (!loaded) return null;

  // Helper function to handle option selection
  const handleOptionSelect = (option) => {
    if (!editLevel) return;
    
    // Update localStorage
    localStorage.setItem("Correct Answer", option);
    // Update local state to trigger re-render
    setCorrectAnswer(option);
    // Send to state machine
    send(`OPTION${option}`);
  };

  const deleteCurrentConjecture = async (currentUUID) => {
    if (!currentUUID) {
      alert("No level to delete.");
      return;
    }

    // Confirm deletion
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this entire level? This action cannot be undone."
    );
    
    if (confirmDelete) {
      try {
        await deleteFromDatabaseConjectureWithCurrentOrg(currentUUID);
        // Reset everything after successful deletion
        currentConjecture.clearConjecture();
        resetConjectureValues();
        backCallback();
      } catch (error) {
        console.error('Error during deletion:', error);
        alert("Failed to delete level. Please try again.");
        backCallback();
      }
    }
  };
  
  const handlePublish = async (currentUUID) => {
    const success = await writeToDatabaseConjectureWithCurrentOrg(currentUUID);
    if (success) {
      currentConjecture.clearConjecture();
      resetConjectureValues();
      backCallback();
    }
  };

  const handleSaveDraft = async (currentUUID) => {
    const success = await writeToDatabaseConjectureDraftWithCurrentOrg(currentUUID);
    if (success) {
      currentConjecture.clearConjecture();
      resetConjectureValues();
      backCallback();
    }
  };

  return (
    <>
      <Background height={height} width={width} />
      <NameBox height={height} width={width} boxState={state.value} username={userName}/>
      <PINBox height={height} width={width} />
      <PublicCheckbox height={height} width={width} />
      <StartBox height={height * 0.5} width={width * 0.5} x={5} y={4.6} boxState={null} similarityScores={null} inCE={true} />
      <IntermediateBox height={height * 0.5} width={width * 0.5} x={9} y={1.906} boxState={null} similarityScores={null} inCE={true} />
      <EndBox height={height * 0.5} width={width * 0.5} x={13} y={1.2035} boxState={null} similarityScores={null} inCE={true} />
      
      {/* Multiple Choice Options */}
      <Button
        height={height * 0.04}
        width={width * 0.04}
        x={width * 0.10}
        y={height * 0.61}
        color={correctAnswer === "A" ? green : blue}
        fontSize={20}
        fontColor={correctAnswer === "A" ? black : white}
        text={correctAnswer === "A" ? "A ✓" : "A"}
        fontWeight={100}
        callback={() => handleOptionSelect("A")}
      />
      <Button
        height={height * 0.04}
        width={width * 0.04}
        x={width * 0.10}
        y={height * 0.70}
        color={correctAnswer === "B" ? green : blue}
        fontSize={20}
        fontColor={correctAnswer === "B" ? black : white}
        text={correctAnswer === "B" ? "B ✓" : "B"}
        fontWeight={100}
        callback={() => handleOptionSelect("B")}
      />
      <Button
        height={height * 0.04}
        width={width * 0.04}
        x={width * 0.10}
        y={height * 0.79}
        color={correctAnswer === "C" ? green : blue}
        fontSize={20}
        fontColor={correctAnswer === "C" ? black : white}
        text={correctAnswer === "C" ? "C ✓" : "C"}
        fontWeight={100}
        callback={() => handleOptionSelect("C")}
      />
      <Button
        height={height * 0.04}
        width={width * 0.04}
        x={width * 0.10}
        y={height * 0.88}
        color={correctAnswer === "D" ? green : blue}
        fontSize={20}
        fontColor={correctAnswer === "D" ? black : white}
        text={correctAnswer === "D" ? "D ✓" : "D"}
        fontWeight={100}
        callback={() => handleOptionSelect("D")}
      />

      {/* Only show the pose editor, save, publish, and cancel buttons if the user is editing */}
      {getEditLevel() ? (
        <>
        {/* Button to Pose Editor */}
        <Button
          height={height * 0.12}
          width={width * 0.0950}
          x={width * 0.17}
          y={height * 0.42}
          color={blue}
          fontSize={21}
          fontColor={white}
          text={"POSE EDITOR"}
          fontWeight={800}
          callback={editCallback}
        />
        {/* Test Button */}
        <Button
          width={width * 0.1}
          x={width * 0.86}
          y={height * 0.17}
          color={blue}
          fontSize={width * 0.015}
          fontColor={white}
          text={"TEST POSES"}
          fontWeight={800}
          callback={testCallback} // Go to test button
        />
        {/* Save button */}
        <RectButton
          height={height * 0.13}
          width={width * 0.26}
          x={width * 0.38}
          y={height * 0.93}
          color={neonGreen}
          fontSize={width * 0.014}
          fontColor={white}
          text={"SAVE DRAFT"}
          fontWeight={800}
          callback={() => handleSaveDraft(currentConjecture.getCurrentUUID())}
          />
        {/* Cancel button */}
        <RectButton
          height={height * 0.13}
          width={width * 0.26}
          x={width * 0.71}
          y={height * 0.93}
          color={red}
          fontSize={width * 0.015}
          fontColor={white}
          text={"CANCEL"}
          fontWeight={800}
          callback={() => {
            // data hasn't been saved
            const confirmLeave = window.confirm("You didnt save your work. Are you sure you want to leave?");
            if (confirmLeave) {
              // if User confirmed, clear local storage and go back
              currentConjecture.clearConjecture();
              resetConjectureValues();
              backCallback();
            }
          }}
        />
        <RectButton
          height={height * 0.13}
          width={width * 0.26}
          x={width * 0.51}
          y={height * 0.93}
          color={red}
          fontSize={width * 0.015}
          fontColor={white}
          text={"DELETE"}
          fontWeight={800}
          callback={() => deleteCurrentConjecture(currentConjecture.getCurrentUUID())}
        />
        {/* Publish button */}
        <RectButton
          height={height * 0.13}
          width={width * 0.26}
          x={width * 0.25}
          y={height * 0.93}
          color={blue}
          fontSize={width * 0.015}
          fontColor={white}
          text={"PUBLISH"}
          fontWeight={800}
          callback={() => handlePublish(currentConjecture.getCurrentUUID())}
        />
        </>
        )
        :(null) // don't show any of the above things during a preview
      }

      {/* Show BACK button only during preview mode (editLevel === false) */}
      {!getEditLevel() && (
        <Button
          height={height * 0.32}
          width={width * 0.07}
          x={width * 0.06}
          y={height * 0.15}
          color={red}
          fontSize={width * 0.015}
          fontColor={white}
          text={"BACK"}
          fontWeight={800}
          callback={() => {
            currentConjecture.clearConjecture();
            resetConjectureValues();
            backCallback();
          }}
        />
      )}
    </>
  );
};

  
export default ConjectureModule;