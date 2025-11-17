import React, { useState, useEffect } from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import Background from "../Background";
import { blue, white, red, neonGreen, green, black } from "../../utils/colors";
import RectButton from "../RectButton";
import { getCurricularListWithCurrentOrg, writeToDatabaseGameSelect, writeToDatabaseNewSession } from "../../firebase/database";
import { getUserNameFromDatabase, getCurrentUserContext, getCurrentClassContext, getClassInfo, getClassesInOrg } from "../../firebase/userDatabase";
import { CurricularSelectorBoxes } from "./CurricularSelectorModuleBoxes";
import { useMachine } from "@xstate/react";
import { Curriculum } from "../CurricularModule/CurricularModule";
import PixiLoader from "../utilities/PixiLoader";

export let playGame = false; // keep track of whether the curricular content list is being used to edit or play games.

export function getPlayGame() {
  return playGame;
}

export function setPlayGame(trueOrFalse) {
  playGame = trueOrFalse;
}

export async function handlePIN(curricular, message = "Please Enter the PIN.", firebaseApp = null) { // this function is meant to be used as an if statement (ex: if(await handlePIN){...} )
  const existingPIN = curricular["pin"] || curricular["CurricularPIN"];

  if (existingPIN == "" || existingPIN == "undefined" || existingPIN == null) { // no existing PIN
    return true;
  }

  // Check hierarchy - if user can edit without PIN, skip PIN check
  if (firebaseApp) {
    try {
      const { getAuth } = await import("firebase/auth");
      const { canEditWithoutPIN, getCurrentUserContext } = await import("../../firebase/userDatabase");
      const auth = getAuth(firebaseApp);
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userContext = await getCurrentUserContext(firebaseApp);
        const resourceOwnerId = curricular.AuthorID || curricular.createdBy;
        const resourceOrgId = userContext?.orgId; // Assuming game is in current org
        
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

  if (enteredPIN == existingPIN) { // PIN is successful
    return true;
  }
  else if (enteredPIN != null && enteredPIN != "") { // recursively try to have the user enter a PIN when it is incorrect
    return handlePIN(curricular, "Incorrect PIN, please try again.", firebaseApp);
  }
  return false; // do nothing if cancel is clicked
}

async function handleGameClicked(curricular, curricularCallback, setLoading, firebaseApp) {
  if (Curriculum.getCurrentUUID() === curricular["UUID"]) {
    Curriculum.setCurrentUUID(null);
    return;
  }

  setLoading(true); // start loading

  try {
    if (playGame) {
      Curriculum.setCurrentUUID(curricular["UUID"]);
      await Curriculum.setCurricularEditor(curricular);
    } else if (await handlePIN(curricular, "Please Enter the PIN.", firebaseApp) && !playGame) {
      console.log("Attempting to edit game");
      Curriculum.setCurrentUUID(curricular["UUID"]);
      await Curriculum.setCurricularEditor(curricular);
    } else {
    // PIN was cancelled - don't proceed
    setLoading(false);
    return; // Exit early, don't call curricularCallback
    }

    setLoading(false); // stop loading before callback
    console.log("Levels fetched, redirecting!");
    curricularCallback();
  } catch (error) {
    console.error("Error in handleGameClicked:", error);
    setLoading(false); // make sure loading is turned off on error
  }
}


const CurricularSelectModule = (props) => {
  
  const { height, width, mainCallback, curricularCallback, userRole, firebaseApp } = props;
  const [curricularList, setCurricularList] = useState([]);
  const [filteredCurricularList, setFilteredCurricularList] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCurricular, setSelectedCurricular] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPublic, setShowPublic] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const isPlayMode = getPlayGame();
        
        if (isPlayMode) {
          // PLAY mode: show only games assigned to current class
          const { classId, orgId } = await getCurrentClassContext(firebaseApp);
          
          if (!isMounted) return;
          
          if (!classId || !orgId) {
            console.warn('No class context found');
            if (isMounted) {
              setCurricularList([]); // Empty list to show message
              setLoading(false);
            }
            return;
          }
          
          // Get games assigned to current class
          const classInfo = await getClassInfo(orgId, classId, firebaseApp);
          const assignedGameIds = classInfo?.assignedGames ? Object.keys(classInfo.assignedGames) : [];
          
          console.log('Current class:', classId, 'Assigned games:', assignedGameIds);
          
          // Get all games
          const allGames = await getCurricularListWithCurrentOrg(isPlayMode);
          
          if (!isMounted) return;
          
          // Filter only games assigned to current class
          const classGames = allGames ? allGames.filter(game => assignedGameIds.includes(game.UUID)) : [];
          
          console.log('Filtered games for class:', classGames.length, 'out of', allGames ? allGames.length : 0);
          if (isMounted) {
            setCurricularList(classGames);
          }
        } else {
          // EDIT mode: show all games created by current user
          console.log('EDIT mode: showing all user games');
          const result = await getCurricularListWithCurrentOrg(isPlayMode);
          if (isMounted) {
            setCurricularList(result || []);
          }
        }
        
        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        // console.error('Error fetching data:', error);
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
    
    // Load classes for filter
    const loadClasses = async () => {
      try {
        const userContext = await getCurrentUserContext(firebaseApp);
        if (userContext?.orgId) {
          const orgClasses = await getClassesInOrg(userContext.orgId, firebaseApp);
          const classList = Object.keys(orgClasses).map(classId => ({
            id: classId,
            name: orgClasses[classId]?.name || 'Unknown Class'
          }));
          if (isMounted) {
            setClasses(classList);
          }
        }
      } catch (error) {
        console.error('Error loading classes:', error);
      }
    };
    loadClasses();
  }, []);
  
  // Apply filters
  useEffect(() => {
    let isMounted = true;
    
    const applyFilters = async () => {
      let filtered = [...curricularList];
      const userContext = await getCurrentUserContext(firebaseApp);
      
      // Filter by class if selected
      if (selectedClassId && userContext?.orgId) {
        try {
          const classInfo = await getClassInfo(userContext.orgId, selectedClassId, firebaseApp);
          const assignedGameIds = classInfo?.assignedGames ? Object.keys(classInfo.assignedGames) : [];
          
          // Filter to show only games assigned to selected class
          filtered = filtered.filter(game => {
            const gameId = game.UUID || game.id;
            return assignedGameIds.includes(gameId);
          });
        } catch (error) {
          console.error('Error filtering by class:', error);
        }
      }
      
      // Filter by public/private - if showPublic is false, hide public games from other orgs
      // Note: This is simplified - full implementation would require orgId in game data
      
      // Only update state if component is still mounted
      if (isMounted) {
        setFilteredCurricularList(filtered);
        setCurrentPage(0); // Reset to first page when filters change
      }
    };
    
    applyFilters();
    
    // Cleanup function to prevent state update on unmounted component
    return () => {
      isMounted = false;
    };
  }, [curricularList, selectedClassId, showPublic, firebaseApp]);

  // Listen for user context changes (organization/class switches)
  useEffect(() => {
    let isMounted = true;
    
    const handleUserContextChange = () => {
      console.log('CurricularSelector: User context changed, refreshing curricular list...');
      const fetchData = async () => {
        try {
          const isPlayMode = getPlayGame();
          console.log('CurricularSelector: Play mode:', isPlayMode);
          
          if (isPlayMode) {
            // PLAY mode: show only games assigned to current class
            const { classId, orgId } = await getCurrentClassContext(firebaseApp);
            console.log('CurricularSelector: Current class context:', { classId, orgId });
            
            if (!isMounted) return;
            
            if (!classId || !orgId) {
              console.warn('CurricularSelector: No class context found');
              if (isMounted) {
                setCurricularList([]); // Empty list to show message
                setLoading(false);
              }
              return;
            }
            
            // Get games assigned to current class
            const classInfo = await getClassInfo(orgId, classId, firebaseApp);
            const assignedGameIds = classInfo?.assignedGames ? Object.keys(classInfo.assignedGames) : [];
            
            console.log('CurricularSelector: Updated current class:', classId, 'Assigned games:', assignedGameIds);
            
            // Get all games
            const allGames = await getCurricularListWithCurrentOrg(isPlayMode);
            
            if (!isMounted) return;
            
            // Filter only games assigned to current class
            const classGames = allGames ? allGames.filter(game => assignedGameIds.includes(game.UUID)) : [];
            
            console.log('CurricularSelector: Updated filtered games for class:', classGames.length, 'out of', allGames.length);
            if (isMounted) {
              setCurricularList(classGames);
            }
          } else {
            // EDIT mode: show all games created by current user
            console.log('CurricularSelector: EDIT mode: showing all user games');
            const result = await getCurricularListWithCurrentOrg(isPlayMode);
            console.log('CurricularSelector: Updated games for edit mode:', result?.length || 0);
            if (isMounted) {
              setCurricularList(result || []);
            }
          }
          
          if (isMounted) {
            setLoading(false);
          }
        } catch (error) {
          console.error('CurricularSelector: Error refreshing data:', error);
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchData();
    };

    // Add event listener
    console.log('CurricularSelector: Adding userContextChanged event listener');
    window.addEventListener('userContextChanged', handleUserContextChange);

    // Cleanup
    return () => {
      isMounted = false;
      console.log('CurricularSelector: Removing userContextChanged event listener');
      window.removeEventListener('userContextChanged', handleUserContextChange);
    };
  }, [firebaseApp]);

  //use to get a fixed number of conjectures per page and to navigate between the pages
  const curricularPerPage = 7;
  const totalPages = Math.ceil((filteredCurricularList?.length || 0) / curricularPerPage);

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

  // Function to handle curricular selection
  const handleCurricularSelection = (curricular) => {
    if (selectedCurricular && selectedCurricular.UUID === curricular.UUID) {
      setSelectedCurricular(null); // Deselect if clicking the same curricular
    } else {
      setSelectedCurricular(curricular); // Select the new curricular
    }
  };

  // use to determine the subset of games to display based on the current page
  const startIndex = currentPage * curricularPerPage;
  const currentCurriculars = (filteredCurricularList || []).slice(startIndex, startIndex + curricularPerPage);

  // draw the buttons that show the author name, name of game, and keywords, and the add conjecture button
  const drawCurricularList = (xMultiplier, yMultiplier, fontSizeMultiplier, totalWidth, totalHeight) => {
    return (
      <>
        {currentCurriculars.map((curricular, index) => (
          <RectButton
            key={`author-${index}`}
            height={totalHeight / 2 * yMultiplier}
            width={totalWidth * 0.8}
            x={totalWidth * (xMultiplier - 0.08)}
            y={totalHeight * index * 4 * fontSizeMultiplier + totalHeight * yMultiplier * 0.75}
            color={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? neonGreen : white}
            fontSize={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? totalWidth * fontSizeMultiplier / 1.1 : totalWidth * fontSizeMultiplier / 1.4}
            fontColor={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? white : blue}
            text={curricular["author"] || curricular["CurricularAuthor"] || "Unknown"}
            fontWeight="bold"
            callback={() => {
              handleCurricularSelection(curricular);
            }}
          />
        ))}

        {currentCurriculars.map((curricular, index) => (
          <RectButton
            key={`name-${index}`}
            height={totalHeight / 2 * yMultiplier}
            width={totalWidth * 0.6}
            x={totalWidth * (xMultiplier + 0.25)}
            y={totalHeight * index * 4 * fontSizeMultiplier + totalHeight * yMultiplier * 0.75}
            color={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? neonGreen : white}
            fontSize={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? totalWidth * fontSizeMultiplier / 1.1 : totalWidth * fontSizeMultiplier / 1.4}
            fontColor={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? white : blue}
            text={curricular["name"] || curricular["CurricularName"] || "Untitled"}
            fontWeight="bold"
            callback={() => {
              handleCurricularSelection(curricular);
            }}
          />
        ))}

        {currentCurriculars.map((curricular, index) => (
          <RectButton
            key={`keywords-${index}`}
            height={totalHeight / 2 * yMultiplier}
            width={totalWidth * 0.8}
            x={totalWidth * (xMultiplier + 0.5)}
            y={totalHeight * index * 4 * fontSizeMultiplier + totalHeight * yMultiplier * 0.75}
            color={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? neonGreen : white}
            fontSize={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? totalWidth * fontSizeMultiplier / 1.1 : totalWidth * fontSizeMultiplier / 1.4}
            fontColor={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? white : blue}
            text={curricular["keywords"] || curricular["CurricularKeywords"] || ""}
            fontWeight="bold"
            callback={() => {
              handleCurricularSelection(curricular);
            }}
          />
        ))}

        {/* show an X if the game (curricular) is published */}
        {currentCurriculars.map((curricular, index) => (
          <RectButton
            key={`status-${index}`}
            height={totalHeight / 2 * yMultiplier}
            width={totalWidth * (xMultiplier * 0.85)}
            x={totalWidth * xMultiplier - totalWidth * xMultiplier * 0.95}
            y={totalHeight * index * 4 * fontSizeMultiplier + totalHeight * yMultiplier * 0.75}
            color={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? neonGreen : white}
            fontSize={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? totalWidth * fontSizeMultiplier / 1.1 : totalWidth * fontSizeMultiplier / 1.4}
            fontColor={selectedCurricular && selectedCurricular.UUID === curricular["UUID"] ? white : blue}
            text={curricular["isFinal"] ? "X" : " "}
            fontWeight="bold"
            callback={() => {
              handleCurricularSelection(curricular);
            }}
          />
        ))}
      </>
    );
  };

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
        callback={() => {
          Curriculum.setCurrentUUID(null);
          setSelectedCurricular(null);
          mainCallback();
        }}
      />

      <RectButton
        height={height * 0.13}
        width={width * 0.26}
        x={width * 0.68}
        y={height * 0.93}
        color={green}
        alpha={selectedCurricular ? 1 : 0.3}
        fontSize={width * 0.014}
        fontColor={white}
        text="OK"
        fontWeight={800}
        callback={
          selectedCurricular 
            ? () => handleGameClicked(selectedCurricular, curricularCallback, setLoading, firebaseApp)
            : null
        }
      />

      <CurricularSelectorBoxes height={height} width={width} />
      
      {curricularList.length === 0 ? (
        <Text
          text={getPlayGame() 
            ? "No games available. Contact your teacher to be assigned to a class or to have games assigned to your class."
            : "No games found. Create some games first."}
          x={width * 0.15}
          y={height * 0.4}
          style={new TextStyle({
            fontFamily: "Arial",
            fontSize: 24,
            fill: [blue],
            wordWrap: true,
            wordWrapWidth: width * 0.7,
          })}
        />
      ) : (
        drawCurricularList(0.15, 0.3, 0.018, width, height)
      )}
    </>
  );
};

export default CurricularSelectModule;