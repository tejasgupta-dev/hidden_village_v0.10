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
  
  // Track if component is mounted to prevent state updates on unmounted component
  const isMountedRef = useRef(true);
  
  // Search and pagination states
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userCurrentPage, setUserCurrentPage] = useState(0);
  const [assignedUserSearchTerm, setAssignedUserSearchTerm] = useState('');
  const [assignedUserCurrentPage, setAssignedUserCurrentPage] = useState(0);
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
        // Students can't assign users
        classList = [];
      }
      
      // Load users in organization
      const orgUsers = await getUsersByOrganizationFromDatabase(orgId, firebaseApp);
      
      // Filter out Admin and Developer roles - only show Students and Teachers
      const filteredUsers = orgUsers.filter(user => {
        const userRole = user.roleInOrg || user.userRole || 'Member';
        return userRole === 'Student' || userRole === 'Teacher';
      });
      
      // Check again if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      if (isMountedRef.current) {
        setClasses(classList);
        setUsers(filteredUsers);
        setLoading(false);
      }
    } catch (error) {
      // console.error('Error loading data:', error); // Убираем вывод ошибки
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
      
      // console.log(`Found ${assignedUsersList.length} unique users across ${classIds.length} classes`); // Убираем лишний лог
      if (isMountedRef.current) {
        setAssignedUsers(assignedUsersList);
      }
    } catch (error) {
      // console.error('Error loading assigned users:', error); // Убираем вывод ошибки
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
      
      // console.error('Error removing user from class:', error); // Убираем вывод ошибки в консоль
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
    const filtered = getFilteredUsers();
    const startIndex = userCurrentPage * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalUserPages = () => {
    return Math.ceil(getFilteredUsers().length / itemsPerPage);
  };

  // Filter and paginate assigned users
  const getFilteredAssignedUsers = () => {
    return assignedUsers.filter(user => {
      const userName = user.userName || user.userEmail || 'Unknown';
      return userName.toLowerCase().includes(assignedUserSearchTerm.toLowerCase());
    });
  };

  const getPaginatedAssignedUsers = () => {
    const filtered = getFilteredAssignedUsers();
    const startIndex = assignedUserCurrentPage * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalAssignedUserPages = () => {
    return Math.ceil(getFilteredAssignedUsers().length / itemsPerPage);
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
      
      // console.error('Error assigning users:', error); // Убираем вывод ошибки
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
      
      {/* Role-based message */}
      {currentUserRole === 'Teacher' && (
        <Text
          text="You can only assign users to classes where you are a teacher"
          x={width * 0.1}
          y={height * 0.12}
          style={new TextStyle({
            fontFamily: "Arial",
            fontSize: 16,
            fill: [black],
          })}
        />
      )}

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

      {/* User Search */}
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
      {getPaginatedUsers().map((user, index) => (
        <React.Fragment key={user.userId}>
          <RectButton
            height={30}
            width={width * 0.35}
            x={width * 0.1}
            y={height * 0.25 + (index * 35)}
            color={selectedUsers.includes(user.userId) ? green : blue}
            fontSize={12}
            fontColor={white}
            text={`${selectedUsers.includes(user.userId) ? '✓ ' : ''}${user.userName || user.userEmail || 'Unknown'} (${user.roleInOrg || 'Member'})`}
            fontWeight={400}
            callback={() => handleUserToggle(user.userId)}
          />
        </React.Fragment>
      ))}
      
      {/* User Pagination */}
      {getTotalUserPages() > 1 && (
        <>
          <Text
            text={`Page ${userCurrentPage + 1} of ${getTotalUserPages()}`}
            x={width * 0.1}
            y={height * 0.25 + (getPaginatedUsers().length * 35) + 10}
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
            y={height * 0.25 + (getPaginatedUsers().length * 35) + 35}
            color={userCurrentPage > 0 ? blue : red}
            fontSize={12}
            fontColor={white}
            text="Prev"
            fontWeight={400}
            callback={() => userCurrentPage > 0 && setUserCurrentPage(userCurrentPage - 1)}
          />
          <RectButton
            height={25}
            width={60}
            x={width * 0.2}
            y={height * 0.25 + (getPaginatedUsers().length * 35) + 35}
            color={userCurrentPage < getTotalUserPages() - 1 ? blue : red}
            fontSize={12}
            fontColor={white}
            text="Next"
            fontWeight={400}
            callback={() => userCurrentPage < getTotalUserPages() - 1 && setUserCurrentPage(userCurrentPage + 1)}
          />
        </>
      )}
      
      {getFilteredUsers().length === 0 && (
        <Text
          text={userSearchTerm ? "No users found matching search." : "No users found."}
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

      {/* Assigned User Search */}
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
        </>
      )}

      {/* Assigned Users List */}
      {selectedClasses.length > 0 && getPaginatedAssignedUsers().map((user, index) => (
        <React.Fragment key={user.userId}>
          <RectButton
            height={30}
            width={width * 0.2}
            x={width * 0.75}
            y={height * 0.25 + (index * 35)}
            color={red}
            fontSize={12}
            fontColor={white}
            text={`✗ ${user.userName || user.userEmail || 'Unknown'} (${user.roleInOrg || 'Member'})`}
            fontWeight={400}
            callback={() => handleRemoveUserFromClass(user.userId)}
          />
        </React.Fragment>
      ))}
      
      {/* Assigned User Pagination */}
      {selectedClasses.length > 0 && getTotalAssignedUserPages() > 1 && (
        <>
          <Text
            text={`Page ${assignedUserCurrentPage + 1} of ${getTotalAssignedUserPages()}`}
            x={width * 0.75}
            y={height * 0.25 + (getPaginatedAssignedUsers().length * 35) + 10}
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
            y={height * 0.25 + (getPaginatedAssignedUsers().length * 35) + 35}
            color={assignedUserCurrentPage > 0 ? blue : red}
            fontSize={12}
            fontColor={white}
            text="Prev"
            fontWeight={400}
            callback={() => assignedUserCurrentPage > 0 && setAssignedUserCurrentPage(assignedUserCurrentPage - 1)}
          />
          <RectButton
            height={25}
            width={60}
            x={width * 0.85}
            y={height * 0.25 + (getPaginatedAssignedUsers().length * 35) + 35}
            color={assignedUserCurrentPage < getTotalAssignedUserPages() - 1 ? blue : red}
            fontSize={12}
            fontColor={white}
            text="Next"
            fontWeight={400}
            callback={() => assignedUserCurrentPage < getTotalAssignedUserPages() - 1 && setAssignedUserCurrentPage(assignedUserCurrentPage + 1)}
          />
        </>
      )}
      
      {selectedClasses.length > 0 && getFilteredAssignedUsers().length === 0 && (
        <Text
          text={assignedUserSearchTerm ? "No assigned users found matching search." : "No users assigned to this class"}
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
        y={height * 0.7}
        style={new TextStyle({
          fontFamily: "Arial",
          fontSize: 18,
          fill: [black],
        })}
      />

      {/* Assign Button */}
      <RectButton
        height={height * 0.08}
        width={width * 0.2}
        x={width * 0.1}
        y={height * 0.8}
        color={green}
        fontSize={width * 0.012}
        fontColor={white}
        text={assigning ? "ASSIGNING..." : "ASSIGN USERS"}
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

export default AssignStudentsModule;
