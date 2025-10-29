import React, { useState, useEffect, useRef } from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { blue, white, red, green, black } from "../../utils/colors";
import RectButton from "../RectButton";
import Background from "../Background";
import firebase from "firebase/compat/app";
import { getAuth } from "firebase/auth";
import {
  getCurrentUserContext,
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
  
  // Track if component is mounted to prevent state updates on unmounted component
  const isMountedRef = useRef(true);
  
  // Search and pagination states
  const [gameSearchTerm, setGameSearchTerm] = useState('');
  const [gameCurrentPage, setGameCurrentPage] = useState(0);
  const [assignedGameSearchTerm, setAssignedGameSearchTerm] = useState('');
  const [assignedGameCurrentPage, setAssignedGameCurrentPage] = useState(0);
  const itemsPerPage = 8; // Show 8 items per page

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      
      // Load user's games (only games created by current user)
      const allGames = await getCurricularListWithCurrentOrg(false);
      const userGames = allGames ? allGames.filter(game => {
        return game.AuthorID === currentUser.uid;
      }) : [];
      
      // Check again if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      if (isMountedRef.current) {
        setClasses(classList);
        setGames(userGames);
        setLoading(false);
      }
    } catch (error) {
      // console.error('Error loading data:', error); // Убираем вывод ошибки
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
      
      // Convert Set to Array and get full game info
      const assignedGameIds = Array.from(allAssignedGameIds);
      const assignedGamesList = games.filter(game => assignedGameIds.includes(game.UUID));
      
      // console.log(`Found ${assignedGamesList.length} unique games across ${classIds.length} classes`); // Убираем лишний лог
      if (isMountedRef.current) {
        setAssignedGames(assignedGamesList);
      }
    } catch (error) {
      // console.error('Error loading assigned games:', error); // Убираем вывод ошибки
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
      
      // console.error('Error removing game from class:', error); // Убираем вывод ошибки
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
    const filtered = getFilteredGames();
    const startIndex = gameCurrentPage * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalGamePages = () => {
    return Math.ceil(getFilteredGames().length / itemsPerPage);
  };

  // Filter and paginate assigned games
  const getFilteredAssignedGames = () => {
    return assignedGames.filter(game => {
      const gameName = game.name || 'Unnamed Game';
      return gameName.toLowerCase().includes(assignedGameSearchTerm.toLowerCase());
    });
  };

  const getPaginatedAssignedGames = () => {
    const filtered = getFilteredAssignedGames();
    const startIndex = assignedGameCurrentPage * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalAssignedGamePages = () => {
    return Math.ceil(getFilteredAssignedGames().length / itemsPerPage);
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
      
      // console.error('Error assigning games:', error); // Убираем вывод ошибки
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
            fontSize: 24,
            fill: [black],
          })}
        />
      </>
    );
  }

  return (
    <>
      <Background height={height} width={width} />
      
      {/* Title */}
      <Text
        text="ASSIGN GAMES TO CLASSES"
        x={width * 0.1}
        y={height * 0.05}
        style={new TextStyle({
          fontFamily: "Futura",
          fontSize: 50,
          fontWeight: 800,
          fill: [blue],
        })}
      />
      
      {/* Role-based message */}
      {currentUserRole === 'Teacher' && (
        <Text
          text="You can only assign your own games to classes where you are a teacher"
          x={width * 0.1}
          y={height * 0.12}
          style={new TextStyle({
            fontFamily: "Arial",
            fontSize: 16,
            fill: [black],
          })}
        />
      )}

      {/* Games Section */}
      <Text
        text="Select Games:"
        x={width * 0.1}
        y={height * 0.15}
        style={new TextStyle({
          fontFamily: "Arial",
          fontSize: 24,
          fontWeight: "bold",
          fill: [black],
        })}
      />

      {/* Game Search */}
      <Text
        text="Search:"
        x={width * 0.1}
        y={height * 0.2}
        style={new TextStyle({
          fontFamily: "Arial",
          fontSize: 16,
          fill: [black],
        })}
      />
      <RectButton
        height={25}
        width={width * 0.25}
        x={width * 0.15}
        y={height * 0.2}
        color={white}
        fontSize={12}
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
      {getPaginatedGames().map((game, index) => (
        <React.Fragment key={game.UUID}>
          <RectButton
            height={30}
            width={width * 0.35}
            x={width * 0.1}
            y={height * 0.25 + (index * 35)}
            color={selectedGames.includes(game.UUID) ? green : blue}
            fontSize={14}
            fontColor={white}
            text={`${selectedGames.includes(game.UUID) ? '✓ ' : ''}${game.name || 'Unnamed Game'}`}
            fontWeight={400}
            callback={() => handleGameToggle(game.UUID)}
          />
        </React.Fragment>
      ))}
      
      {/* Game Pagination */}
      {getTotalGamePages() > 1 && (
        <>
          <Text
            text={`Page ${gameCurrentPage + 1} of ${getTotalGamePages()}`}
            x={width * 0.1}
            y={height * 0.25 + (getPaginatedGames().length * 35) + 10}
            style={new TextStyle({
              fontFamily: "Arial",
              fontSize: 14,
              fill: [black],
            })}
          />
          <RectButton
            height={25}
            width={60}
            x={width * 0.1}
            y={height * 0.25 + (getPaginatedGames().length * 35) + 35}
            color={gameCurrentPage > 0 ? blue : red}
            fontSize={12}
            fontColor={white}
            text="Prev"
            fontWeight={400}
            callback={() => gameCurrentPage > 0 && setGameCurrentPage(gameCurrentPage - 1)}
          />
          <RectButton
            height={25}
            width={60}
            x={width * 0.2}
            y={height * 0.25 + (getPaginatedGames().length * 35) + 35}
            color={gameCurrentPage < getTotalGamePages() - 1 ? blue : red}
            fontSize={12}
            fontColor={white}
            text="Next"
            fontWeight={400}
            callback={() => gameCurrentPage < getTotalGamePages() - 1 && setGameCurrentPage(gameCurrentPage + 1)}
          />
        </>
      )}
      
      {getFilteredGames().length === 0 && (
        <Text
          text={gameSearchTerm ? "No games found matching search." : "No games found. Create some games first."}
          x={width * 0.1}
          y={height * 0.3}
          style={new TextStyle({
            fontFamily: "Arial",
            fontSize: 16,
            fill: [black],
          })}
        />
      )}

      {/* Classes Section */}
      <Text
        text="Select Classes:"
        x={width * 0.55}
        y={height * 0.15}
        style={new TextStyle({
          fontFamily: "Arial",
          fontSize: 24,
          fontWeight: "bold",
          fill: [black],
        })}
      />

      {/* Classes Section */}
      <Text
        text="Select Classes:"
        x={width * 0.55}
        y={height * 0.15}
        style={new TextStyle({
          fontFamily: "Arial",
          fontSize: 24,
          fontWeight: "bold",
          fill: [black],
        })}
      />

      {/* Classes List */}
      {classes.map((classItem, index) => (
        <React.Fragment key={classItem.id}>
          <RectButton
            height={30}
            width={width * 0.35}
            x={width * 0.55}
            y={height * 0.2 + (index * 35)}
            color={selectedClasses.includes(classItem.id) ? green : blue}
            fontSize={14}
            fontColor={white}
            text={`${selectedClasses.includes(classItem.id) ? '✓ ' : ''}${classItem.name}`}
            fontWeight={400}
            callback={() => handleClassToggle(classItem.id)}
          />
        </React.Fragment>
      ))}

      {/* Assigned Games Section */}
      <Text
        text="Assigned Games (Click to Remove):"
        x={width * 0.75}
        y={height * 0.15}
        style={new TextStyle({
          fontFamily: "Arial",
          fontSize: 24,
          fontWeight: "bold",
          fill: [black],
        })}
      />

      {/* Assigned Game Search */}
      {selectedClasses.length > 0 && (
        <>
          <Text
            text="Search:"
            x={width * 0.75}
            y={height * 0.2}
            style={new TextStyle({
              fontFamily: "Arial",
              fontSize: 16,
              fill: [black],
            })}
          />
          <RectButton
            height={25}
            width={width * 0.15}
            x={width * 0.8}
            y={height * 0.2}
            color={white}
            fontSize={12}
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
        </>
      )}

      {/* Assigned Games List */}
      {selectedClasses.length > 0 && getPaginatedAssignedGames().map((game, index) => (
        <React.Fragment key={game.UUID}>
          <RectButton
            height={30}
            width={width * 0.2}
            x={width * 0.75}
            y={height * 0.25 + (index * 35)}
            color={red}
            fontSize={12}
            fontColor={white}
            text={`✗ ${game.name || 'Unnamed Game'}`}
            fontWeight={400}
            callback={() => handleRemoveGameFromClass(game.UUID)}
          />
        </React.Fragment>
      ))}
      
      {/* Assigned Game Pagination */}
      {selectedClasses.length > 0 && getTotalAssignedGamePages() > 1 && (
        <>
          <Text
            text={`Page ${assignedGameCurrentPage + 1} of ${getTotalAssignedGamePages()}`}
            x={width * 0.75}
            y={height * 0.25 + (getPaginatedAssignedGames().length * 35) + 10}
            style={new TextStyle({
              fontFamily: "Arial",
              fontSize: 14,
              fill: [black],
            })}
          />
          <RectButton
            height={25}
            width={60}
            x={width * 0.75}
            y={height * 0.25 + (getPaginatedAssignedGames().length * 35) + 35}
            color={assignedGameCurrentPage > 0 ? blue : red}
            fontSize={12}
            fontColor={white}
            text="Prev"
            fontWeight={400}
            callback={() => assignedGameCurrentPage > 0 && setAssignedGameCurrentPage(assignedGameCurrentPage - 1)}
          />
          <RectButton
            height={25}
            width={60}
            x={width * 0.85}
            y={height * 0.25 + (getPaginatedAssignedGames().length * 35) + 35}
            color={assignedGameCurrentPage < getTotalAssignedGamePages() - 1 ? blue : red}
            fontSize={12}
            fontColor={white}
            text="Next"
            fontWeight={400}
            callback={() => assignedGameCurrentPage < getTotalAssignedGamePages() - 1 && setAssignedGameCurrentPage(assignedGameCurrentPage + 1)}
          />
        </>
      )}
      
      {selectedClasses.length > 0 && getFilteredAssignedGames().length === 0 && (
        <Text
          text={assignedGameSearchTerm ? "No assigned games found matching search." : "No games assigned to this class"}
          x={width * 0.75}
          y={height * 0.3}
          style={new TextStyle({
            fontFamily: "Arial",
            fontSize: 14,
            fill: [black],
          })}
        />
      )}

      {/* Selection Summary */}
      <Text
        text={`Selected: ${selectedGames.length} game(s), ${selectedClasses.length} class(es)`}
        x={width * 0.1}
        y={height * 0.7}
        style={new TextStyle({
          fontFamily: "Arial",
          fontSize: 18,
          fill: [black],
        })}
      />

      {/* Assignment Status */}
      {selectedGames.length > 0 && selectedClasses.length > 0 && (
        <Text
          text={`This will assign ${selectedGames.length} game(s) to ${selectedClasses.length} class(es)`}
          x={width * 0.1}
          y={height * 0.75}
          style={new TextStyle({
            fontFamily: "Arial",
            fontSize: 16,
            fill: [blue],
          })}
        />
      )}

      {/* Assign Button */}
      <RectButton
        height={height * 0.08}
        width={width * 0.2}
        x={width * 0.1}
        y={height * 0.8}
        color={green}
        fontSize={width * 0.012}
        fontColor={white}
        text={assigning ? "ASSIGNING..." : "ASSIGN GAMES"}
        fontWeight={800}
        callback={handleAssign}
      />

      {/* Back Button */}
      <RectButton
        height={height * 0.08}
        width={width * 0.2}
        x={width * 0.4}
        y={height * 0.8}
        color={red}
        fontSize={width * 0.012}
        fontColor={white}
        text="BACK"
        fontWeight={800}
        callback={onBack}
      />
    </>
  );
};

export default AssignContentModule;
