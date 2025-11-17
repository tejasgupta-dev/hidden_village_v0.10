import React, { useState, useEffect } from 'react';
import Background from "../Background";
import { blue, white, red, neonGreen, green, black } from "../../utils/colors";
import RectButton from "../RectButton";
import { getConjectureListWithCurrentOrg, searchConjecturesByWordWithCurrentOrg } from "../../firebase/database";
import { ConjectureSelectorBoxes } from "./ConjectureSelectorModuleBoxes";
import { useMachine } from "@xstate/react";
import { Curriculum } from "../CurricularModule/CurricularModule";
import { currentConjecture, setEditLevel, setGoBackFromLevelEdit } from "../ConjectureModule/ConjectureModule"
import PixiLoader from '../utilities/PixiLoader';
import { getAuth } from "firebase/auth";
import firebase from "firebase/compat/app";
import { canEditWithoutPIN, getCurrentUserContext, getClassesInOrg, getCurrentClassContext, getClassInfo } from "../../firebase/userDatabase";

import InputBox from '../InputBox';

export let addToCurricular = false; // keep track of whether the conjecture selector is used for curricular purposes or editing existing conjectures.

export function getAddToCurricular() {
  return addToCurricular;
}

export function setAddtoCurricular(trueOrFalse) {
  addToCurricular = trueOrFalse;
}

export async function handlePIN(conjecture, message = "Please Enter the PIN.", firebaseApp = null) { // this function is meant to be used as an if statement (ex: if(await handlePIN){...} )
  const existingPIN = conjecture["Text Boxes"]?.["PIN"] || conjecture["PIN"];
  if (existingPIN == "" || existingPIN == "undefined" || existingPIN == null) { // no existing PIN
    return true;
  }

  // Check hierarchy - if user can edit without PIN, skip PIN check
  if (firebaseApp) {
    try {
      const auth = getAuth(firebaseApp);
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userContext = await getCurrentUserContext(firebaseApp);
        const resourceOwnerId = conjecture.AuthorID || conjecture.createdBy;
        const resourceOrgId = userContext?.orgId; // Assuming level is in current org
        
        if (resourceOwnerId && resourceOrgId) {
          const canEdit = await canEditWithoutPIN(
            currentUser.uid,
            resourceOwnerId,
            resourceOrgId,
            userContext?.role,
            resourceOrgId,
            firebaseApp
          );
          
          if (canEdit) {
            return true; // Can edit without PIN
          }
        }
        
        // Check if user is the owner
        if (resourceOwnerId === currentUser.uid) {
          return true; // Owner can always edit without PIN
        }
      }
    } catch (error) {
      console.error('Error checking edit permission:', error);
      // Fall through to PIN check on error
    }
  }

  const enteredPIN = prompt(message);
  if (existingPIN == "" || enteredPIN == existingPIN) { // PIN is successful
    return true;
  }
  else if (enteredPIN != null && enteredPIN != "") { // recursively try to have the user enter a PIN when it is incorrect
    return handlePIN(conjecture, "Incorrect PIN, please try again.", firebaseApp);
  }
  return false; // do nothing if cancel is clicked
}

async function handleLevelClicked(conjecture, conjectureCallback, firebaseApp = null) {
  console.log('handleLevelClicked: Called with conjecture:', conjecture);
  console.log('handleLevelClicked: addToCurricular =', addToCurricular);
  
  if (addToCurricular) { // if the user wants to preview a level before adding it to the game in the game editor
    console.log('handleLevelClicked: Preview mode - setting up for curricular preview');
    setEditLevel(false);
    setGoBackFromLevelEdit("LEVELSELECT");
    currentConjecture.setConjecture(conjecture);
    conjectureCallback(conjecture);
  }
  else if (await handlePIN(conjecture, "Please Enter the PIN.", firebaseApp)) { // when the user pulls up the list of levels in the level editor
    console.log('handleLevelClicked: Edit mode - setting up for level editing');
    setEditLevel(true);
    setGoBackFromLevelEdit("MAIN");
    currentConjecture.setConjecture(conjecture);
    conjectureCallback(conjecture);
  } else {
    console.log('handleLevelClicked: PIN was cancelled or invalid');
  }
}

const ConjectureSelectModule = (props) => {
  console.log("ConjectureSelectModule Runs now");
  const { height, width, conjectureCallback, backCallback, curricularCallback, firebaseApp } = props;
  const app = firebaseApp || firebase.app();
  const [conjectureList, setConjectureList] = useState([]);
  const [filteredConjectureList, setFilteredConjectureList] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedConjecture, setSelectedConjecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPublic, setShowPublic] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const result = await getConjectureListWithCurrentOrg(addToCurricular);
        
        if (!isMounted) return;
        
        setConjectureList(result);
        
        // Load classes for filter
        const userContext = await getCurrentUserContext(app);
        if (userContext?.orgId) {
          const orgClasses = await getClassesInOrg(userContext.orgId, app);
          const classList = Object.keys(orgClasses).map(classId => ({
            id: classId,
            name: orgClasses[classId]?.name || 'Unknown Class'
          }));
          if (isMounted) {
            setClasses(classList);
          }
        }
        
        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    // Cleanup function to prevent state update on unmounted component
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Apply filters
  useEffect(() => {
    let isMounted = true;
    
    const applyFilters = async () => {
      let filtered = [...conjectureList];
      const userContext = await getCurrentUserContext(app);
      
      // Filter by class if selected
      if (selectedClassId && userContext?.orgId) {
        try {
          const classInfo = await getClassInfo(userContext.orgId, selectedClassId, app);
          const assignedLevelIds = classInfo?.assignedLevels ? Object.keys(classInfo.assignedLevels) : [];
          
          // Filter to show only levels assigned to selected class
          filtered = filtered.filter(level => {
            const levelId = level.UUID || level.id;
            return assignedLevelIds.includes(levelId);
          });
        } catch (error) {
          console.error('Error filtering by class:', error);
        }
      }
      
      // Filter by public/private - if showPublic is false, hide public levels from other orgs
      // Note: This is simplified - full implementation would require orgId in level data
      // For now, we show all levels when showPublic is true
      
      // Only update state if component is still mounted
      if (isMounted) {
        setFilteredConjectureList(filtered);
        setCurrentPage(0); // Reset to first page when filters change
      }
    };
    
    applyFilters();
    
    // Cleanup function to prevent state update on unmounted component
    return () => {
      isMounted = false;
    };
  }, [conjectureList, selectedClassId, showPublic, app]);

  //use to get a fixed number of conjectures per page and to navigate between the pages
  const conjecturesPerPage = 7;
  const totalPages = Math.ceil((filteredConjectureList?.length || 0) / conjecturesPerPage);

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const searchConjectures = async (searchWord) => {
    try {
      console.log("Search Button")
      const result = await searchConjecturesByWordWithCurrentOrg(searchWord);
      console.log(result)

      setConjectureList(result);
      setCurrentPage(0); // Reset to first page after search
    }
    catch (error) {
      console.log("No conjectures found")
    }
  };

  // Function to handle conjecture selection
  const handleConjectureSelection = (conjecture) => {
    if (selectedConjecture && selectedConjecture.UUID === conjecture.UUID) {
      setSelectedConjecture(null); // Deselect if clicking the same conjecture
    } else {
      setSelectedConjecture(conjecture); // Select the new conjecture
    }
  };

  // use to determine the subset of conjectures to display based on the current page
  const startIndex = currentPage * conjecturesPerPage;
  const currentConjectures = (filteredConjectureList || []).slice(startIndex, startIndex + conjecturesPerPage);

  // draw the buttons that show the author name, name of conjecture, and keywords, and the add conjecture button
  const drawConjectureList = (xMultiplier, yMultiplier, fontSizeMultiplier, totalWidth, totalHeight) => {
    return (
      <>
        {currentConjectures.map((conjecture, index) => (
          <RectButton
            key={`author-${index}`}
            height={totalHeight / 2 * yMultiplier}
            width={totalWidth * 0.8}
            x={totalWidth * (xMultiplier - 0.08)}
            y={totalHeight * index * 4 * fontSizeMultiplier + totalHeight * yMultiplier * 0.75}
            color={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? neonGreen : white}
            fontSize={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? totalWidth * fontSizeMultiplier / 1.1 : totalWidth * fontSizeMultiplier / 1.3}
            fontColor={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? white : blue}
            text={conjecture["Text Boxes"]["Author Name"]}
            fontWeight="bold"
            callback={() => handleConjectureSelection(conjecture)}
          />
        ))}

        {currentConjectures.map((conjecture, index) => (
          <RectButton
            key={`name-${index}`}
            height={totalHeight / 2 * yMultiplier}
            width={totalWidth * 0.6}
            x={totalWidth * (xMultiplier + 0.25)}
            y={totalHeight * index * 4 * fontSizeMultiplier + totalHeight * yMultiplier * 0.75}
            color={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? neonGreen : white}
            fontSize={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? totalWidth * fontSizeMultiplier / 1.1 : totalWidth * fontSizeMultiplier / 1.3}
            fontColor={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? white : blue}
            text={conjecture["Text Boxes"]["Conjecture Name"]}
            fontWeight="bold"
            callback={() => handleConjectureSelection(conjecture)}
          />
        ))}

        {currentConjectures.map((conjecture, index) => (
          <RectButton
            key={`keywords-${index}`}
            height={totalHeight / 2 * yMultiplier}
            width={totalWidth * 0.8}
            x={totalWidth * (xMultiplier + 0.5)}
            y={totalHeight * index * 4 * fontSizeMultiplier + totalHeight * yMultiplier * 0.75}
            color={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? neonGreen : white}
            fontSize={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? totalWidth * fontSizeMultiplier / 1.1 : totalWidth * fontSizeMultiplier / 1.3}
            fontColor={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? white : blue}
            text={conjecture["Text Boxes"]["Conjecture Keywords"] === "undefined" ? '' : conjecture["Text Boxes"]["Conjecture Keywords"]}
            fontWeight="bold"
            callback={() => handleConjectureSelection(conjecture)}
          />
        ))}

        {/* only show these in the game editor (disabled when just selecting a level to edit) */}
        {addToCurricular ? (
          currentConjectures.map((conjecture, index) => (
            <RectButton
              key={`add-${index}`}
              height={0.01}
              width={0.01}
              x={totalWidth * xMultiplier - totalWidth * xMultiplier * 0.7}
              y={totalHeight * index * 4 * fontSizeMultiplier + totalHeight * yMultiplier - totalHeight * yMultiplier * 0.15}
              color={white}
              fontSize={totalWidth * fontSizeMultiplier * 2}
              fontColor={neonGreen}
              text={"+"}
              fontWeight="bold"
              callback={() => {
                Curriculum.addConjecture(conjecture);
                curricularCallback();
              }}
            />
          )))
          // show whether the conjectures are drafts or finals in the level editor
          : (currentConjectures.map((conjecture, index) => (
            <RectButton
              key={`status-${index}`}
              height={totalHeight / 2 * yMultiplier}
              width={totalWidth * (xMultiplier * 0.85)}
              x={totalWidth * xMultiplier - totalWidth * xMultiplier * 0.95}
              y={totalHeight * index * 4 * fontSizeMultiplier + totalHeight * yMultiplier * 0.75}
              color={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? neonGreen : white}
              fontSize={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? totalWidth * fontSizeMultiplier / 1.1 : totalWidth * fontSizeMultiplier / 1.3}
              fontColor={selectedConjecture && selectedConjecture.UUID === conjecture.UUID ? white : blue}
              text={conjecture["isFinal"] ? "X" : " "}
              fontWeight="bold"
              callback={() => handleConjectureSelection(conjecture)}
            />
          )))
        }
      </>
    );
  };

  const [search, setSearch] = useState("search by one word");

  function sendSearchPrompt() {
    const enteredSearch = prompt("Search by Word", search);
    // Treat null or empty as "cleared"
    if (enteredSearch === null || enteredSearch.trim() === "") {
      setSearch(""); // triggers show all
    } else {
      setSearch(enteredSearch);
    }
  }

    if (loading) {
    return (
      <>
        <Background height={height * 1.1} width={width} />
        <PixiLoader width={width} height={height} />
      </>
    );
  }

  return (
    <>
      <Background height={height * 1.1} width={width} />

      <RectButton
        height={height * 0.13}
        width={width * 0.26}
        x={width * 0.15}
        y={height * 0.93}
        color={blue}
        fontSize={width * 0.014}
        fontColor={white}
        text={"PREVIOUS"}
        fontWeight={800}
        callback={totalPages <= 1 || currentPage === 0 ? null : prevPage}
        alpha={totalPages <= 1 || currentPage === 0 ? 0.3 : 1}
      />

      <RectButton
        height={height * 0.13}
        width={width * 0.26}
        x={width * 0.56}
        y={height * 0.93}
        color={blue}
        fontSize={width * 0.014}
        fontColor={white}
        text={"NEXT"}
        fontWeight={800}
        callback={totalPages <= 1 || currentPage === totalPages - 1 ? null : nextPage}
        alpha={totalPages <= 1 || currentPage === totalPages - 1 ? 0.3 : 1}
      />

      {/* This is my search button */}
      <RectButton
        height={height * .13}
        width={width * 0.26}
        x={width * 0.9}
        y={height * 0.05}
        color={blue}
        fontSize={width * 0.014}
        fontColor={white}
        text={"SEARCH"}
        fontWeight={800}
        callback={() => searchConjectures(search)}
      />

      <InputBox
        height={height * 0.15}
        width={width * 0.5}
        x={width * 0.7}
        y={height * 0.05}
        color={white}
        fontSize={width * 0.015}
        fontColor={black}
        text={search}
        fontWeight={300}
        callback={sendSearchPrompt} // Create Popup
      />
      
      {/* Filters */}
      <RectButton
        height={height * 0.08}
        width={width * 0.15}
        x={width * 0.1}
        y={height * 0.05}
        color={showPublic ? green : white}
        fontSize={width * 0.012}
        fontColor={showPublic ? white : black}
        text={showPublic ? "SHOW PUBLIC: YES" : "SHOW PUBLIC: NO"}
        fontWeight={600}
        callback={() => setShowPublic(!showPublic)}
      />
      
      {/* Class Filter */}
      {classes.length > 0 && (
        <RectButton
          height={height * 0.08}
          width={width * 0.15}
          x={width * 0.27}
          y={height * 0.05}
          color={selectedClassId ? green : white}
          fontSize={width * 0.012}
          fontColor={selectedClassId ? white : black}
          text={selectedClassId ? `CLASS: ${classes.find(c => c.id === selectedClassId)?.name || 'Selected'}` : "FILTER BY CLASS"}
          fontWeight={600}
          callback={() => {
            // Cycle through classes or show prompt
            const currentIndex = selectedClassId ? classes.findIndex(c => c.id === selectedClassId) : -1;
            const nextIndex = (currentIndex + 1) % (classes.length + 1);
            if (nextIndex === 0) {
              setSelectedClassId(null); // Show all
            } else {
              setSelectedClassId(classes[nextIndex - 1].id);
            }
          }}
        />
      )}

      <RectButton
        height={height * 0.13}
        width={width * 0.26}
        x={width * 0.80}
        y={height * 0.93}
        color={red}
        fontSize={width * 0.015}
        fontColor={white}
        text={"BACK"}
        fontWeight={800}
        callback={backCallback}
      />

      <RectButton
        height={height * 0.13}
        width={width * 0.26}
        x={width * 0.68}
        y={height * 0.93}
        color={green}
        alpha={selectedConjecture ? 1 : 0.3}
        fontSize={width * 0.014}
        fontColor={white}
        text={"OK"}
        fontWeight={800}
        callback={
          selectedConjecture
            ? () => handleLevelClicked(selectedConjecture, conjectureCallback, app)
            : null
        }
      />

      <ConjectureSelectorBoxes height={height} width={width} />
      {drawConjectureList(0.15, 0.3, 0.018, width, height)}
    </>
  );
};

export default ConjectureSelectModule;