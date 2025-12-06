import React, { useState, useEffect, useRef } from 'react';
import { Text, Graphics } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { blue, white, red, green, black } from "../../utils/colors";
import RectButton from "../RectButton";
import Background from "../Background";
import { getAuth } from "firebase/auth";
import {
  getCurrentUserContext,
  getCurrentClassContext,
  getClassesInOrg,
  getUserClassesInOrg,
  getClassInfo,
  assignGamesToClasses
} from "../../firebase/userDatabase";
import { getCurricularListWithCurrentOrg } from "../../firebase/database";

const AssignContentModule = ({ width, height, firebaseApp, onBack }) => {
  const [classes, setClasses] = useState([]);
  const [games, setGames] = useState([]);
  const [selectedGames, setSelectedGames] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [assignedGames, setAssignedGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [removingGame, setRemovingGame] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [currentClassName, setCurrentClassName] = useState('Loading...');
  
  // Track if component is mounted to prevent state updates on unmounted component
  const isMountedRef = useRef(true);
  
  // Search and pagination states
  const [gameSearchTerm, setGameSearchTerm] = useState('');
  const [gameCurrentPage, setGameCurrentPage] = useState(0);
  const [classCurrentPage, setClassCurrentPage] = useState(0);
  const [assignedGameSearchTerm, setAssignedGameSearchTerm] = useState('');
  const [assignedGameCurrentPage, setAssignedGameCurrentPage] = useState(0);
  const [showPublic, setShowPublic] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [showPublic]);

  const loadData = async () => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      
      const auth = getAuth(firebaseApp);
      const currentUser = auth.currentUser;
      
      const { orgId, role } = await getCurrentUserContext(firebaseApp);
      
      // Check if component is still mounted before continuing
      if (!isMountedRef.current) return;
      
      if (isMountedRef.current) {
        setCurrentUserId(currentUser.uid);
        setCurrentOrgId(orgId);
        setCurrentUserRole(role);
      }
      
      // Get current class context
      const { className } = await getCurrentClassContext(firebaseApp);
      if (isMountedRef.current) {
        setCurrentClassName(className || 'None');
      }
      
      // Load classes based on role
      let classList;
      if (role === 'Admin' || role === 'Developer') {
        // Admins and Developers can see all classes
        const allClasses = await getClassesInOrg(orgId, firebaseApp);
        classList = Object.entries(allClasses).map(([id, data]) => ({
          id,
          ...data
        }));
      } else if (role === 'Teacher') {
        // Teachers can only see classes where they are teachers
        const userClasses = await getUserClassesInOrg(currentUser.uid, orgId, firebaseApp);
        const classPromises = Object.keys(userClasses).map(async (classId) => {
          const classInfo = await getClassInfo(orgId, classId, firebaseApp);
          return { id: classId, ...classInfo };
        });
        classList = await Promise.all(classPromises);
      } else {
        // Students can't assign content
        classList = [];
      }
      
      // Load all games from organization (and public games from other orgs if showPublic is true)
      const allGames = await getCurricularListWithCurrentOrg(false, showPublic);
      
      // Check again if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      if (isMountedRef.current) {
        setClasses(classList);
        setGames(allGames || []);
        setLoading(false);
      }
    } catch (error) {
      // console.error('Error loading data:', error); // Remove error output
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleGameToggle = (gameId) => {
    setSelectedGames(prev => 
      prev.includes(gameId) 
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    );
  };

  const handleClassToggle = async (classId) => {
    // Only allow selecting one class at a time
    if (selectedClasses.includes(classId)) {
      // Deselect if already selected
      setSelectedClasses([]);
      setAssignedGames([]);
    } else {
      // Select new class (replace any existing selection)
      setSelectedClasses([classId]);
      await loadAssignedGames([classId]);
    }
  };

  const loadAssignedGames = async (classIds) => {
    try {
      const allAssignedGameIds = new Set(); // Use Set to avoid duplicates
      
      // Load games from all selected classes
      for (const classId of classIds) {
        const classInfo = await getClassInfo(currentOrgId, classId, firebaseApp);
        const assignedGameIds = classInfo?.assignedGames ? Object.keys(classInfo.assignedGames) : [];
        
        assignedGameIds.forEach(gameId => allAssignedGameIds.add(gameId));
      }
      
      // Load ALL games (including public from other orgs) to find assigned games
      // This ensures all assigned games are shown regardless of showPublic filter
      const allGames = await getCurricularListWithCurrentOrg(false, true);
      
      // Convert Set to Array and get full game info
      const assignedGameIds = Array.from(allAssignedGameIds);
      const assignedGamesList = (allGames || []).filter(game => assignedGameIds.includes(game.UUID));
      
      // console.log(`Found ${assignedGamesList.length} unique games across ${classIds.length} classes`); // Remove unnecessary log
      if (isMountedRef.current) {
        setAssignedGames(assignedGamesList);
      }
    } catch (error) {
      // console.error('Error loading assigned games:', error); // Remove error output
      if (isMountedRef.current) {
        setAssignedGames([]);
      }
    }
  };

  const handleRemoveGameFromClass = async (gameId) => {
    if (selectedClasses.length === 0) {
      alert('Please select a class first');
      return;
    }

    // Prevent multiple simultaneous calls
    if (removingGame) {
      return;
    }

    const classId = selectedClasses[0];
    
    try {
      setRemovingGame(true);
      const { removeGameFromClass } = await import('../../firebase/userDatabase');
      await removeGameFromClass(currentOrgId, classId, gameId, firebaseApp);
      
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      alert('Game removed from class successfully');
      
      // Refresh the assigned games list
      await loadAssignedGames([classId]);
      
    } catch (error) {
      // Check if component is still mounted before showing error
      if (!isMountedRef.current) return;
      
      // console.error('Error removing game from class:', error); // Remove error output
      alert('Failed to remove game: ' + error.message);
    } finally {
      if (isMountedRef.current) {
        setRemovingGame(false);
      }
    }
  };

  // Filter and paginate games
  const getFilteredGames = () => {
    // Get IDs of games already assigned to selected classes
    const assignedGameIds = new Set(assignedGames.map(game => game.UUID));
    
    return games.filter(game => {
      // Filter by public/private - if showPublic is false, hide public games from other orgs
      if (!showPublic && game._isFromOtherOrg === true) {
        return false;
      }
      
      // Exclude games already assigned to selected classes
      if (selectedClasses.length > 0 && assignedGameIds.has(game.UUID)) {
        return false;
      }
      
      // Filter by search term
      const gameName = game.name || 'Unnamed Game';
      return gameName.toLowerCase().includes(gameSearchTerm.toLowerCase());
    });
  };

  const getPaginatedGames = () => {
    return getFilteredGames();
  };

  const getTotalGamePages = () => {
    const containerHeight = height * 0.5;
    const headerHeight = 40;
    const itemHeight = 35;
    const availableHeight = containerHeight - headerHeight;
    const itemsPerContainer = Math.max(1, Math.floor(availableHeight / itemHeight));
    return Math.ceil(getFilteredGames().length / itemsPerContainer);
  };

  // Filter and paginate assigned games
  const getFilteredAssignedGames = () => {
    return assignedGames.filter(game => {
      const gameName = game.name || 'Unnamed Game';
      return gameName.toLowerCase().includes(assignedGameSearchTerm.toLowerCase());
    });
  };
  
  // Paginate classes
  const getPaginatedClasses = () => {
    return classes;
  };
  
  const getTotalClassPages = () => {
    const containerHeight = height * 0.5;
    const headerHeight = height * 0.04;
    const itemHeight = height * 0.057;
    const availableHeight = containerHeight - headerHeight;
    const itemsPerContainer = Math.max(1, Math.floor(availableHeight / itemHeight));
    return Math.ceil(classes.length / itemsPerContainer);
  };

  const getPaginatedAssignedGames = () => {
    return getFilteredAssignedGames();
  };

  const getTotalAssignedGamePages = () => {
    const containerHeight = height * 0.5;
    const headerHeight = height * 0.04;
    const itemHeight = height * 0.057;
    const availableHeight = containerHeight - headerHeight;
    const itemsPerContainer = Math.max(1, Math.floor(availableHeight / itemHeight));
    return Math.ceil(getFilteredAssignedGames().length / itemsPerContainer);
  };

  const handleAssign = async () => {
    if (selectedGames.length === 0) {
      alert('Please select at least one game');
      return;
    }
    
    if (selectedClasses.length === 0) {
      alert('Please select at least one class');
      return;
    }

    try {
      setAssigning(true);
      
      const auth = getAuth(firebaseApp);
      await assignGamesToClasses(currentOrgId, selectedGames, selectedClasses, auth.currentUser.uid, firebaseApp);
      
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      alert(`Successfully assigned ${selectedGames.length} game(s) to ${selectedClasses.length} class(es)`);
      
      // Refresh assigned games list to reflect new assignments
      if (selectedClasses.length > 0) {
        await loadAssignedGames(selectedClasses);
      }
      
      // Reset game selections (keep class selection)
      setSelectedGames([]);
      
    } catch (error) {
      // Check if component is still mounted before showing error
      if (!isMountedRef.current) return;
      
      // console.error('Error assigning games:', error); // Remove error output
      alert('Failed to assign games: ' + error.message);
    } finally {
      if (isMountedRef.current) {
        setAssigning(false);
      }
    }
  };

  if (loading) {
    return (
      <>
        <Background height={height} width={width} />
        <Text 
          text="Loading..."
          x={width * 0.4}
          y={height * 0.5}
          style={new TextStyle({
            fontFamily: "Arial",
            fontSize: width * 0.016,
            fill: [black],
          })}
        />
      </>
    );
  }

  // Container dimensions
  const containerWidth = width * 0.25;
  const containerHeight = height * 0.5;
  const containerY = height * 0.25;
  const gamesContainerX = width * 0.1;
  const classesContainerX = width * 0.4;
  const assignedGamesContainerX = width * 0.7;
  const headerHeight = height * 0.04;
  const filterButtonHeight = height * 0.04;
  const searchHeight = height * 0.03;
  const itemHeight = height * 0.037;
  const availableHeight = containerHeight - headerHeight - filterButtonHeight - searchHeight - 15;
  const itemsPerContainer = Math.max(1, Math.floor(availableHeight / itemHeight));

  return (
    <>
      <Background height={height} width={width} />
      
      {/* Title */}
      <Text
        text="ASSIGN GAMES"
        x={width * 0.12}
        y={height * 0.01}
        style={new TextStyle({
          fontFamily: "Futura",
          fontSize: width * 0.06,
          fontWeight: 800,
          fill: [blue],
          letterSpacing: -5,
        })}
      />
      
      {/* Current Class */}
      <Text
        text={`CURRENT CLASS: ${currentClassName}`}
        x={width * 0.12}
        y={height * 0.12}
        style={new TextStyle({
          fontFamily: "Arial",
          fontSize: width * 0.018,
          fontWeight: "bold",
          fill: [black],
        })}
      />

      {/* Left Container - GAMES */}
      <Graphics
        x={gamesContainerX}
        y={containerY}
        draw={(g) => {
          g.beginFill(0xfff8dc); // cornsilk
          g.drawRect(0, 0, containerWidth, containerHeight);
          g.endFill();
          g.lineStyle(3, 0x000000, 1);
          g.drawRect(0, 0, containerWidth, containerHeight);
        }}
      />
      
      {/* GAMES Header */}
      <Text
        x={gamesContainerX + containerWidth * 0.05}
        y={containerY + headerHeight * 0.3}
        text="GAMES"
        style={new TextStyle({
          fontFamily: 'Arial',
          fontSize: width * 0.014,
          fontWeight: 'bold',
          fill: [black],
        })}
      />
      
      {/* Public Filter Button */}
      <RectButton
        height={height * 0.04}
        width={containerWidth * 0.85}
        x={gamesContainerX + containerWidth * 0.05}
        y={containerY + headerHeight + height * 0.04}
        color={showPublic ? green : white}
        fontSize={width * 0.007}
        fontColor={showPublic ? white : black}
        text={showPublic ? "SHOW PUBLIC: YES" : "SHOW PUBLIC: NO"}
        fontWeight={600}
        callback={() => setShowPublic(!showPublic)}
      />
      
      {/* Game Search */}
      <RectButton
        height={25}
        width={containerWidth * 0.85}
        x={gamesContainerX + containerWidth * 0.05}
        y={containerY + headerHeight + 5}
        color={white}
        fontSize={width * 0.009}
        fontColor={black}
        text={gameSearchTerm || "Type to search..."}
        fontWeight={400}
        callback={() => {
          const searchTerm = prompt("Enter search term:", gameSearchTerm);
          if (searchTerm !== null) {
            setGameSearchTerm(searchTerm);
            setGameCurrentPage(0); // Reset to first page
          }
        }}
      />
      
      {/* Games List */}
      {getPaginatedGames().slice(gameCurrentPage * itemsPerContainer, (gameCurrentPage + 1) * itemsPerContainer).map((game, index) => (
        <RectButton
          key={game.UUID}
          height={itemHeight - 5}
          width={containerWidth * 0.9}
          x={gamesContainerX + containerWidth * 0.05}
          y={containerY + headerHeight + filterButtonHeight + searchHeight + 10 + (index * itemHeight)}
          color={selectedGames.includes(game.UUID) ? green : blue}
          fontSize={width * 0.009}
          fontColor={white}
          text={`${selectedGames.includes(game.UUID) ? '✓ ' : ''}${game.name || 'Unnamed Game'}`}
          fontWeight={400}
          callback={() => handleGameToggle(game.UUID)}
        />
      ))}
      
      {/* Games Pagination */}
      <>
        <RectButton
          height={containerHeight * 0.12}
          width={containerWidth * 0.08}
          x={gamesContainerX + containerWidth - containerWidth * 0.1}
          y={containerY + containerHeight - containerHeight * 0.08}
          color={gameCurrentPage > 0 ? green : 0xcccccc}
          fontSize={containerWidth * 0.04}
          fontColor={white}
          text={"<"}
          fontWeight={800}
          callback={() => gameCurrentPage > 0 && setGameCurrentPage(gameCurrentPage - 1)}
        />
        <RectButton
          height={containerHeight * 0.12}
          width={containerWidth * 0.08}
          x={gamesContainerX + containerWidth - containerWidth * 0.05}
          y={containerY + containerHeight - containerHeight * 0.08}
          color={gameCurrentPage < getTotalGamePages() - 1 ? green : 0xcccccc}
          fontSize={containerWidth * 0.04}
          fontColor={white}
          text={">"}
          fontWeight={800}
          callback={() => gameCurrentPage < getTotalGamePages() - 1 && setGameCurrentPage(gameCurrentPage + 1)}
        />
      </>

      {/* Center Container - CLASS */}
      <Graphics
        x={classesContainerX}
        y={containerY}
        draw={(g) => {
          g.beginFill(0xfff8dc); // cornsilk
          g.drawRect(0, 0, containerWidth, containerHeight);
          g.endFill();
          g.lineStyle(3, 0x000000, 1);
          g.drawRect(0, 0, containerWidth, containerHeight);
        }}
      />
      
      {/* CLASS Header */}
      <Text
        x={classesContainerX + containerWidth * 0.05}
        y={containerY + headerHeight * 0.3}
        text="CLASS"
        style={new TextStyle({
          fontFamily: 'Arial',
          fontSize: width * 0.014,
          fontWeight: 'bold',
          fill: [black],
        })}
      />
      
      {/* Classes List */}
      {getPaginatedClasses().slice(classCurrentPage * itemsPerContainer, (classCurrentPage + 1) * itemsPerContainer).map((classItem, index) => (
        <RectButton
          key={classItem.id}
          height={itemHeight - 5}
          width={containerWidth * 0.9}
          x={classesContainerX + containerWidth * 0.05}
          y={containerY + headerHeight + (index * itemHeight)}
          color={selectedClasses.includes(classItem.id) ? green : blue}
          fontSize={width * 0.009}
          fontColor={white}
          text={`${selectedClasses.includes(classItem.id) ? '✓ ' : ''}${classItem.name}`}
          fontWeight={400}
          callback={() => handleClassToggle(classItem.id)}
        />
      ))}
      
      {/* Classes Pagination */}
      <>
        <RectButton
          height={containerHeight * 0.12}
          width={containerWidth * 0.08}
          x={classesContainerX + containerWidth - containerWidth * 0.1}
          y={containerY + containerHeight - containerHeight * 0.08}
          color={classCurrentPage > 0 ? green : 0xcccccc}
          fontSize={containerWidth * 0.04}
          fontColor={white}
          text={"<"}
          fontWeight={800}
          callback={() => classCurrentPage > 0 && setClassCurrentPage(classCurrentPage - 1)}
        />
        <RectButton
          height={containerHeight * 0.12}
          width={containerWidth * 0.08}
          x={classesContainerX + containerWidth - containerWidth * 0.05}
          y={containerY + containerHeight - containerHeight * 0.08}
          color={classCurrentPage < getTotalClassPages() - 1 ? green : 0xcccccc}
          fontSize={containerWidth * 0.04}
          fontColor={white}
          text={">"}
          fontWeight={800}
          callback={() => classCurrentPage < getTotalClassPages() - 1 && setClassCurrentPage(classCurrentPage + 1)}
        />
      </>

      {/* Right Container - GAMES (in class) */}
      <Graphics
        x={assignedGamesContainerX}
        y={containerY}
        draw={(g) => {
          g.beginFill(0xfff8dc); // cornsilk
          g.drawRect(0, 0, containerWidth, containerHeight);
          g.endFill();
          g.lineStyle(3, 0x000000, 1);
          g.drawRect(0, 0, containerWidth, containerHeight);
        }}
      />
      
      {/* GAMES (in class) Header */}
      <Text
        x={assignedGamesContainerX + containerWidth * 0.05}
        y={containerY + headerHeight * 0.3}
        text="GAMES (in class)"
        style={new TextStyle({
          fontFamily: 'Arial',
          fontSize: width * 0.014,
          fontWeight: 'bold',
          fill: [black],
        })}
      />
      
      {/* Assigned Game Search */}
      {selectedClasses.length > 0 && (
        <RectButton
          height={25}
          width={containerWidth * 0.85}
          x={assignedGamesContainerX + containerWidth * 0.05}
          y={containerY + headerHeight + 5}
          color={white}
          fontSize={width * 0.009}
          fontColor={black}
          text={assignedGameSearchTerm || "Type to search..."}
          fontWeight={400}
          callback={() => {
            const searchTerm = prompt("Enter search term:", assignedGameSearchTerm);
            if (searchTerm !== null) {
              setAssignedGameSearchTerm(searchTerm);
              setAssignedGameCurrentPage(0); // Reset to first page
            }
          }}
        />
      )}
      
      {/* Assigned Games List */}
      {selectedClasses.length > 0 && getPaginatedAssignedGames().slice(assignedGameCurrentPage * itemsPerContainer, (assignedGameCurrentPage + 1) * itemsPerContainer).map((game, index) => (
        <RectButton
          key={game.UUID}
          height={itemHeight - 5}
          width={containerWidth * 0.9}
          x={assignedGamesContainerX + containerWidth * 0.05}
          y={containerY + headerHeight + searchHeight + 5 + (index * itemHeight)}
          color={red}
          fontSize={width * 0.009}
          fontColor={white}
          text={`✗ ${game.name || 'Unnamed Game'}`}
          fontWeight={400}
          callback={() => handleRemoveGameFromClass(game.UUID)}
        />
      ))}
      
      {/* Assigned Games Pagination */}
      {selectedClasses.length > 0 && (
        <>
          <RectButton
            height={containerHeight * 0.12}
            width={containerWidth * 0.08}
            x={assignedGamesContainerX + containerWidth - containerWidth * 0.1}
            y={containerY + containerHeight - containerHeight * 0.08}
            color={assignedGameCurrentPage > 0 ? green : 0xcccccc}
            fontSize={containerWidth * 0.04}
            fontColor={white}
            text={"<"}
            fontWeight={800}
            callback={() => assignedGameCurrentPage > 0 && setAssignedGameCurrentPage(assignedGameCurrentPage - 1)}
          />
          <RectButton
            height={containerHeight * 0.12}
            width={containerWidth * 0.08}
            x={assignedGamesContainerX + containerWidth - containerWidth * 0.05}
            y={containerY + containerHeight - containerHeight * 0.08}
            color={assignedGameCurrentPage < getTotalAssignedGamePages() - 1 ? green : 0xcccccc}
            fontSize={containerWidth * 0.04}
            fontColor={white}
            text={">"}
            fontWeight={800}
            callback={() => assignedGameCurrentPage < getTotalAssignedGamePages() - 1 && setAssignedGameCurrentPage(assignedGameCurrentPage + 1)}
          />
        </>
      )}

      {/* Assign Button */}
      <RectButton
        height={height * 0.12}
        width={width * 0.2}
        x={width * 0.1}
        y={height * 0.88}
        color={green}
        fontSize={width * 0.010}
        fontColor={white}
        text={assigning ? "ASSIGNING..." : "ASSIGN GAMES"}
        fontWeight={800}
        callback={handleAssign}
      />

      {/* Back Button */}
      <RectButton
        height={height * 0.08}
        width={width * 0.2}
        x={width * 0.8}
        y={height * 0.88}
        color={red}
        fontSize={width * 0.010}
        fontColor={white}
        text="BACK"
        fontWeight={800}
        callback={onBack}
      />
    </>
  );
};

export default AssignContentModule;
