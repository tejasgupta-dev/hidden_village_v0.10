import React, { useState, useEffect, useRef } from 'react';
import { Text, Graphics } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { blue, white, red, green, black } from "../../utils/colors";
import RectButton from "../RectButton";
import Background from "../Background";
import firebase from "firebase/compat/app";
import { getAuth } from "firebase/auth";
import {
  getCurrentUserContext,
  getCurrentClassContext,
  getClassesInOrg,
  getUserClassesInOrg,
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
  const [removingUser, setRemovingUser] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [currentClassName, setCurrentClassName] = useState('Loading...');
  
  // Track if component is mounted to prevent state updates on unmounted component
  const isMountedRef = useRef(true);
  
  // Search and pagination states
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userCurrentPage, setUserCurrentPage] = useState(0);
  const [classCurrentPage, setClassCurrentPage] = useState(0);
  const [assignedUserSearchTerm, setAssignedUserSearchTerm] = useState('');
  const [assignedUserCurrentPage, setAssignedUserCurrentPage] = useState(0);

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
      
      // Load current class name
      try {
        const classContext = await getCurrentClassContext(firebaseApp);
        if (isMountedRef.current && classContext && classContext.className) {
          setCurrentClassName(classContext.className);
        } else if (isMountedRef.current) {
          setCurrentClassName('No class selected');
        }
      } catch (error) {
        if (isMountedRef.current) {
          setCurrentClassName('No class selected');
        }
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
        // Students can't assign users
        classList = [];
      }
      
      // Load users in organization
      const orgUsers = await getUsersByOrganizationFromDatabase(orgId, firebaseApp);
      
      // Check again if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      if (isMountedRef.current) {
        setClasses(classList);
        setUsers(orgUsers);
        setLoading(false);
      }
    } catch (error) {
      // console.error('Error loading data:', error); // Remove error output
      if (isMountedRef.current) {
        setLoading(false);
      }
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
      
      // console.log(`Found ${assignedUsersList.length} unique users across ${classIds.length} classes`); // Remove unnecessary log
      if (isMountedRef.current) {
        setAssignedUsers(assignedUsersList);
      }
    } catch (error) {
      // console.error('Error loading assigned users:', error); // Remove error output
      if (isMountedRef.current) {
        setAssignedUsers([]);
      }
    }
  };

  const handleRemoveUserFromClass = async (userId) => {
    if (selectedClasses.length === 0) {
      alert('Please select a class first');
      return;
    }

    // Prevent multiple simultaneous calls
    if (removingUser) {
      return;
    }

    const classId = selectedClasses[0];
    
    try {
      setRemovingUser(true);
      const { removeUserFromClass } = await import('../../firebase/userDatabase');
      await removeUserFromClass(currentOrgId, classId, userId, firebaseApp);
      
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      alert('User removed from class successfully');
      
      // Refresh the assigned users list
      await loadAssignedUsers([classId]);
      
    } catch (error) {
      // Check if component is still mounted before showing error
      if (!isMountedRef.current) return;
      
      // console.error('Error removing user from class:', error); // Remove error output to console
      alert('Failed to remove user: ' + error.message);
    } finally {
      if (isMountedRef.current) {
        setRemovingUser(false);
      }
    }
  };

  // Filter and paginate users
  const getFilteredUsers = () => {
    // Get IDs of users already assigned to selected classes
    const assignedUserIds = new Set(assignedUsers.map(user => user.userId));
    
    return users.filter(user => {
      // Exclude users already assigned to selected classes
      if (selectedClasses.length > 0 && assignedUserIds.has(user.userId)) {
        return false;
      }
      
      // Filter by search term
      const userName = user.userName || user.userEmail || 'Unknown';
      return userName.toLowerCase().includes(userSearchTerm.toLowerCase());
    });
  };

  const getPaginatedUsers = () => {
    return getFilteredUsers();
  };

  const getTotalUserPages = () => {
    const containerHeight = height * 0.5;
    const headerHeight = height * 0.04;
    const searchHeight = height * 0.03;
    const itemHeight = height * 0.037;
    const availableHeight = containerHeight - headerHeight - searchHeight;
    const itemsPerContainer = Math.max(1, Math.floor(availableHeight / itemHeight));
    return Math.ceil(getFilteredUsers().length / itemsPerContainer);
  };
  
  // Paginate classes
  const getPaginatedClasses = () => {
    return classes;
  };
  
  const getTotalClassPages = () => {
    const containerHeight = height * 0.5;
    const headerHeight = 40;
    const itemHeight = 35;
    const availableHeight = containerHeight - headerHeight;
    const itemsPerContainer = Math.max(1, Math.floor(availableHeight / itemHeight));
    return Math.max(1, Math.ceil(classes.length / itemsPerContainer));
  };

  // Filter and paginate assigned users
  const getFilteredAssignedUsers = () => {
    return assignedUsers.filter(user => {
      const userName = user.userName || user.userEmail || 'Unknown';
      return userName.toLowerCase().includes(assignedUserSearchTerm.toLowerCase());
    });
  };

  const getPaginatedAssignedUsers = () => {
    return getFilteredAssignedUsers();
  };

  const getTotalAssignedUserPages = () => {
    const containerHeight = height * 0.5;
    const headerHeight = height * 0.04;
    const searchHeight = height * 0.03;
    const itemHeight = height * 0.037;
    const availableHeight = containerHeight - headerHeight - searchHeight;
    const itemsPerContainer = Math.max(1, Math.floor(availableHeight / itemHeight));
    return Math.ceil(getFilteredAssignedUsers().length / itemsPerContainer);
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
      
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      alert(`Successfully assigned ${selectedUsers.length} user(s) to ${selectedClasses.length} class(es)`);
      
      // Refresh assigned users list to reflect new assignments
      if (selectedClasses.length > 0) {
        await loadAssignedUsers(selectedClasses);
      }
      
      // Reset user selections (keep class selection)
      setSelectedUsers([]);
      
    } catch (error) {
      // Check if component is still mounted before showing error
      if (!isMountedRef.current) return;
      
      // console.error('Error assigning users:', error); // Remove error output
      alert('Failed to assign users: ' + error.message);
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
            fontSize: width * 0.014,
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
  const usersContainerX = width * 0.1;
  const classesContainerX = width * 0.4;
  const assignedUsersContainerX = width * 0.7;
  const headerHeight = 40;
  const searchHeight = 30;
  const itemHeight = 35;
  const availableHeight = containerHeight - headerHeight - searchHeight;
  const itemsPerContainer = Math.max(1, Math.floor(availableHeight / itemHeight));

  return (
    <>
      <Background height={height} width={width} />
      
      {/* Title */}
      <Text
        text="ASSIGN USERS"
        x={width * 0.12}
        y={height * 0.01}
        style={new TextStyle({
          fontFamily: "Futura",
          fontSize: width * 0.058,
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
          fontSize: 24,
          fontWeight: "bold",
          fill: [black],
        })}
      />

      {/* Left Container - USERS */}
      <Graphics
        x={usersContainerX}
        y={containerY}
        draw={(g) => {
          g.beginFill(0xfff8dc); // cornsilk
          g.drawRect(0, 0, containerWidth, containerHeight);
          g.endFill();
          g.lineStyle(3, 0x000000, 1);
          g.drawRect(0, 0, containerWidth, containerHeight);
        }}
      />
      
      {/* USERS Header */}
      <Text
        x={usersContainerX + containerWidth * 0.05}
        y={containerY + headerHeight * 0.3}
        text="USERS"
        style={new TextStyle({
          fontFamily: 'Arial',
          fontSize: width * 0.014,
          fontWeight: 'bold',
          fill: [black],
        })}
      />
      
      {/* User Search */}
      <RectButton
        height={25}
        width={containerWidth * 0.85}
        x={usersContainerX + containerWidth * 0.05}
        y={containerY + headerHeight + 5}
        color={white}
        fontSize={width * 0.009}
        fontColor={black}
        text={userSearchTerm || "Type to search..."}
        fontWeight={400}
        callback={() => {
          const searchTerm = prompt("Enter search term:", userSearchTerm);
          if (searchTerm !== null) {
            setUserSearchTerm(searchTerm);
            setUserCurrentPage(0); // Reset to first page
          }
        }}
      />
      
      {/* Users List */}
      {getPaginatedUsers().slice(userCurrentPage * itemsPerContainer, (userCurrentPage + 1) * itemsPerContainer).map((user, index) => (
        <RectButton
          key={user.userId}
          height={itemHeight*1.2}
          width={containerWidth * 0.9}
          x={usersContainerX + containerWidth * 0.05}
          y={containerY + headerHeight + searchHeight + 5 + (index * itemHeight)}
          color={selectedUsers.includes(user.userId) ? green : blue}
          fontSize={width * 0.009}
          fontColor={white}
          text={`${selectedUsers.includes(user.userId) ? '✓ ' : ''}${user.userName || user.userEmail || 'Unknown'} (${user.roleInOrg || 'Member'})`}
          fontWeight={400}
          callback={() => handleUserToggle(user.userId)}
        />
      ))}
      
      {/* Users Pagination */}
      <>
        <RectButton
          height={containerHeight * 0.12}
          width={containerWidth * 0.08}
          x={usersContainerX + containerWidth - containerWidth * 0.1}
          y={containerY + containerHeight - containerHeight * 0.08}
          color={userCurrentPage > 0 ? green : 0xcccccc}
          fontSize={containerWidth * 0.04}
          fontColor={white}
          text={"<"}
          fontWeight={800}
          callback={() => userCurrentPage > 0 && setUserCurrentPage(userCurrentPage - 1)}
        />
        <RectButton
          height={containerHeight * 0.12}
          width={containerWidth * 0.08}
          x={usersContainerX + containerWidth - containerWidth * 0.05}
          y={containerY + containerHeight - containerHeight * 0.08}
          color={userCurrentPage < getTotalUserPages() - 1 ? green : 0xcccccc}
          fontSize={containerWidth * 0.04}
          fontColor={white}
          text={">"}
          fontWeight={800}
          callback={() => userCurrentPage < getTotalUserPages() - 1 && setUserCurrentPage(userCurrentPage + 1)}
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

      {/* Right Container - USERS (in class) */}
      <Graphics
        x={assignedUsersContainerX}
        y={containerY}
        draw={(g) => {
          g.beginFill(0xfff8dc); // cornsilk
          g.drawRect(0, 0, containerWidth, containerHeight);
          g.endFill();
          g.lineStyle(3, 0x000000, 1);
          g.drawRect(0, 0, containerWidth, containerHeight);
        }}
      />
      
      {/* USERS (in class) Header */}
      <Text
        x={assignedUsersContainerX + containerWidth * 0.05}
        y={containerY + headerHeight * 0.3}
        text="USERS (in class)"
        style={new TextStyle({
          fontFamily: 'Arial',
          fontSize: width * 0.014,
          fontWeight: 'bold',
          fill: [black],
        })}
      />
      
      {/* Assigned User Search */}
      {selectedClasses.length > 0 && (
        <RectButton
          height={25}
          width={containerWidth * 0.85}
          x={assignedUsersContainerX + containerWidth * 0.05}
          y={containerY + headerHeight + 5}
          color={white}
          fontSize={width * 0.007}
          fontColor={black}
          text={assignedUserSearchTerm || "Type to search..."}
          fontWeight={400}
          callback={() => {
            const searchTerm = prompt("Enter search term:", assignedUserSearchTerm);
            if (searchTerm !== null) {
              setAssignedUserSearchTerm(searchTerm);
              setAssignedUserCurrentPage(0); // Reset to first page
            }
          }}
        />
      )}
      
      {/* Assigned Users List */}
      {selectedClasses.length > 0 && getPaginatedAssignedUsers().slice(assignedUserCurrentPage * itemsPerContainer, (assignedUserCurrentPage + 1) * itemsPerContainer).map((user, index) => (
        <RectButton
          key={user.userId}
          height={itemHeight - 5}
          width={containerWidth * 0.9}
          x={assignedUsersContainerX + containerWidth * 0.05}
          y={containerY + headerHeight + searchHeight + 5 + (index * itemHeight)}
          color={red}
          fontSize={width * 0.008}
          fontColor={white}
          text={`✗ ${user.userName || user.userEmail || 'Unknown'} (${user.roleInOrg || 'Member'})`}
          fontWeight={400}
          callback={() => handleRemoveUserFromClass(user.userId)}
        />
      ))}
      
      {/* Assigned Users Pagination */}
      {selectedClasses.length > 0 && (
        <>
          <RectButton
            height={containerHeight * 0.12}
            width={containerWidth * 0.08}
            x={assignedUsersContainerX + containerWidth - containerWidth * 0.1}
            y={containerY + containerHeight - containerHeight * 0.08}
            color={assignedUserCurrentPage > 0 ? green : 0xcccccc}
            fontSize={containerWidth * 0.04}
            fontColor={white}
            text={"<"}
            fontWeight={800}
            callback={() => assignedUserCurrentPage > 0 && setAssignedUserCurrentPage(assignedUserCurrentPage - 1)}
          />
          <RectButton
            height={containerHeight * 0.12}
            width={containerWidth * 0.08}
            x={assignedUsersContainerX + containerWidth - containerWidth * 0.05}
            y={containerY + containerHeight - containerHeight * 0.08}
            color={assignedUserCurrentPage < getTotalAssignedUserPages() - 1 ? green : 0xcccccc}
            fontSize={containerWidth * 0.04}
            fontColor={white}
            text={">"}
            fontWeight={800}
            callback={() => assignedUserCurrentPage < getTotalAssignedUserPages() - 1 && setAssignedUserCurrentPage(assignedUserCurrentPage + 1)}
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
        text={assigning ? "ASSIGNING..." : "ASSIGN USERS"}
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

export default AssignStudentsModule;
