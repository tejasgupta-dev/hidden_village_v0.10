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
  getUsersByOrganizationFromDatabase,
  assignStudentsToClasses
} from "../../firebase/userDatabase";

const AssignStudentsModule = ({ width, height, firebaseApp, onBack }) => {
  const [classes, setClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [assignedUsers, setAssignedUsers] = useState([]);
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
      
      // Load users in organization
      const orgUsers = await getUsersByOrganizationFromDatabase(orgId, firebaseApp);
      
      // Filter out Admin and Developer roles - only show Students and Teachers
      const filteredUsers = orgUsers.filter(user => {
        const userRole = user.roleInOrg || user.userRole || 'Member';
        return userRole === 'Student' || userRole === 'Teacher';
      });
      
      setUsers(filteredUsers);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const handleUserToggle = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleClassToggle = async (classId) => {
    // Only allow selecting one class at a time
    if (selectedClasses.includes(classId)) {
      // Deselect if already selected
      setSelectedClasses([]);
      setAssignedUsers([]);
    } else {
      // Select new class (replace any existing selection)
      setSelectedClasses([classId]);
      await loadAssignedUsers([classId]);
    }
  };

  const loadAssignedUsers = async (classIds) => {
    try {
      const allAssignedUserIds = new Set(); // Use Set to avoid duplicates
      
      // Load users from all selected classes
      for (const classId of classIds) {
        const classInfo = await getClassInfo(currentOrgId, classId, firebaseApp);
        
        // Get students
        if (classInfo?.students) {
          Object.keys(classInfo.students).forEach(userId => allAssignedUserIds.add(userId));
        }
        
        // Get teachers
        if (classInfo?.teachers) {
          Object.keys(classInfo.teachers).forEach(userId => allAssignedUserIds.add(userId));
        }
      }
      
      // Convert Set to Array and get full user info
      const assignedUserIds = Array.from(allAssignedUserIds);
      const assignedUsersList = users.filter(user => assignedUserIds.includes(user.userId));
      
      console.log(`Found ${assignedUsersList.length} unique users across ${classIds.length} classes`);
      setAssignedUsers(assignedUsersList);
    } catch (error) {
      console.error('Error loading assigned users:', error);
      setAssignedUsers([]);
    }
  };

  const handleRemoveUserFromClass = async (userId) => {
    if (selectedClasses.length === 0) {
      alert('Please select a class first');
      return;
    }

    const classId = selectedClasses[0];
    
    try {
      const { removeUserFromClass } = await import('../../firebase/userDatabase');
      await removeUserFromClass(currentOrgId, classId, userId, firebaseApp);
      
      alert('User removed from class successfully');
      
      // Refresh the assigned users list
      await loadAssignedUsers([classId]);
      
    } catch (error) {
      console.error('Error removing user from class:', error);
      alert('Failed to remove user: ' + error.message);
    }
  };

  const handleAssign = async () => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one user');
      return;
    }
    
    if (selectedClasses.length === 0) {
      alert('Please select at least one class');
      return;
    }

    try {
      setAssigning(true);
      
      const auth = getAuth(firebaseApp);
      await assignStudentsToClasses(currentOrgId, selectedUsers, selectedClasses, auth.currentUser.uid, firebaseApp);
      
      alert(`Successfully assigned ${selectedUsers.length} user(s) to ${selectedClasses.length} class(es)`);
      
      // Reset selections
      setSelectedUsers([]);
      setSelectedClasses([]);
      
    } catch (error) {
      console.error('Error assigning users:', error);
      alert('Failed to assign users: ' + error.message);
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
        text="ASSIGN USERS TO CLASSES"
        x={width * 0.1}
        y={height * 0.05}
        style={new TextStyle({
          fontFamily: "Futura",
          fontSize: 50,
          fontWeight: 800,
          fill: [blue],
        })}
      />

      {/* Users Section */}
      <Text
        text="Select Users (Students & Teachers only):"
        x={width * 0.1}
        y={height * 0.15}
        style={new TextStyle({
          fontFamily: "Arial",
          fontSize: 24,
          fontWeight: "bold",
          fill: [black],
        })}
      />

      {/* Users List */}
      {users.map((user, index) => (
        <React.Fragment key={user.userId}>
          <RectButton
            height={30}
            width={width * 0.35}
            x={width * 0.1}
            y={height * 0.2 + (index * 35)}
            color={selectedUsers.includes(user.userId) ? green : blue}
            fontSize={12}
            fontColor={white}
            text={`${selectedUsers.includes(user.userId) ? '✓ ' : ''}${user.userName || user.userEmail || 'Unknown'} (${user.roleInOrg || 'Member'})`}
            fontWeight={400}
            callback={() => handleUserToggle(user.userId)}
          />
        </React.Fragment>
      ))}
      {users.length === 0 && (
        <Text
          text="No users found."
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

      {/* Assigned Users Section */}
      <Text
        text="Assigned Users (Click to Remove):"
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

      {/* Assigned Users List */}
      {assignedUsers.map((user, index) => (
        <React.Fragment key={user.userId}>
          <RectButton
            height={30}
            width={width * 0.2}
            x={width * 0.75}
            y={height * 0.2 + (index * 35)}
            color={red}
            fontSize={12}
            fontColor={white}
            text={`✗ ${user.userName || user.userEmail || 'Unknown'} (${user.roleInOrg || 'Member'})`}
            fontWeight={400}
            callback={() => handleRemoveUserFromClass(user.userId)}
          />
        </React.Fragment>
      ))}
      {assignedUsers.length === 0 && selectedClasses.length > 0 && (
        <Text
          text="No users assigned to this class"
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
        text={`Selected: ${selectedUsers.length} user(s), ${selectedClasses.length} class(es)`}
        x={width * 0.1}
        y={height * 0.65}
        style={new TextStyle({
          fontFamily: "Arial",
          fontSize: 18,
          fill: [black],
        })}
      />

      {/* Assign Button */}
      <RectButton
        height={height * 0.1}
        width={width * 0.2}
        x={width * 0.1}
        y={height * 0.75}
        color={green}
        fontSize={width * 0.012}
        fontColor={white}
        text={assigning ? "ASSIGNING..." : "ASSIGN USERS"}
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

export default AssignStudentsModule;
