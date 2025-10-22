import React, { useState, useEffect } from 'react';
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
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const auth = getAuth(firebaseApp);
      const currentUser = auth.currentUser;
      setCurrentUserId(currentUser.uid);
      
      const { orgId } = await getCurrentUserContext(firebaseApp);
      setCurrentOrgId(orgId);
      
      // Load classes
      const allClasses = await getClassesInOrg(orgId, firebaseApp);
      const classList = Object.entries(allClasses).map(([id, data]) => ({
        id,
        ...data
      }));
      setClasses(classList);
      
      // Load user's games (only games created by current user)
      console.log('AssignContentModule - Loading games for user:', currentUser.uid);
      const allGames = await getCurricularListWithCurrentOrg(false);
      console.log('AssignContentModule - All games from DB:', allGames);
      const userGames = allGames.filter(game => {
        console.log('Checking game:', game.name, 'author:', game.author, 'AuthorID:', game.AuthorID, 'currentUser:', currentUser.uid);
        return game.AuthorID === currentUser.uid;
      });
      console.log('AssignContentModule - Filtered user games:', userGames);
      setGames(userGames);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
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
      
      console.log(`Found ${assignedGamesList.length} unique games across ${classIds.length} classes`);
      setAssignedGames(assignedGamesList);
    } catch (error) {
      console.error('Error loading assigned games:', error);
      setAssignedGames([]);
    }
  };

  const handleRemoveGameFromClass = async (gameId) => {
    if (selectedClasses.length === 0) {
      alert('Please select a class first');
      return;
    }

    const classId = selectedClasses[0];
    
    try {
      const { removeGameFromClass } = await import('../../firebase/userDatabase');
      await removeGameFromClass(currentOrgId, classId, gameId, firebaseApp);
      
      alert('Game removed from class successfully');
      
      // Refresh the assigned games list
      await loadAssignedGames([classId]);
      
    } catch (error) {
      console.error('Error removing game from class:', error);
      alert('Failed to remove game: ' + error.message);
    }
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
      
      alert(`Successfully assigned ${selectedGames.length} game(s) to ${selectedClasses.length} class(es)`);
      
      // Reset selections
      setSelectedGames([]);
      setSelectedClasses([]);
      
    } catch (error) {
      console.error('Error assigning games:', error);
      alert('Failed to assign games: ' + error.message);
    } finally {
      setAssigning(false);
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

      {/* Games List */}
      {games.map((game, index) => (
        <React.Fragment key={game.UUID}>
          <RectButton
            height={30}
            width={width * 0.35}
            x={width * 0.1}
            y={height * 0.2 + (index * 35)}
            color={selectedGames.includes(game.UUID) ? green : blue}
            fontSize={14}
            fontColor={white}
            text={`${selectedGames.includes(game.UUID) ? '✓ ' : ''}${game.name || 'Unnamed Game'}`}
            fontWeight={400}
            callback={() => handleGameToggle(game.UUID)}
          />
        </React.Fragment>
      ))}
      {games.length === 0 && (
        <Text
          text="No games found. Create some games first."
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

      {/* Assigned Games List */}
      {assignedGames.map((game, index) => (
        <React.Fragment key={game.UUID}>
          <RectButton
            height={30}
            width={width * 0.2}
            x={width * 0.75}
            y={height * 0.2 + (index * 35)}
            color={red}
            fontSize={12}
            fontColor={white}
            text={`✗ ${game.name || 'Unnamed Game'}`}
            fontWeight={400}
            callback={() => handleRemoveGameFromClass(game.UUID)}
          />
        </React.Fragment>
      ))}
      {assignedGames.length === 0 && selectedClasses.length > 0 && (
        <Text
          text="No games assigned to this class"
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
        y={height * 0.65}
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
          y={height * 0.7}
          style={new TextStyle({
            fontFamily: "Arial",
            fontSize: 16,
            fill: [blue],
          })}
        />
      )}

      {/* Assign Button */}
      <RectButton
        height={height * 0.1}
        width={width * 0.2}
        x={width * 0.1}
        y={height * 0.75}
        color={green}
        fontSize={width * 0.012}
        fontColor={white}
        text={assigning ? "ASSIGNING..." : "ASSIGN GAMES"}
        fontWeight={800}
        callback={handleAssign}
      />

      {/* Back Button */}
      <RectButton
        height={height * 0.1}
        width={width * 0.2}
        x={width * 0.4}
        y={height * 0.75}
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
