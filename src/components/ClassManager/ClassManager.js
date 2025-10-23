import React, { useState, useEffect } from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { blue, white, red, green, black } from "../../utils/colors";
import RectButton from "../RectButton";
import Background from "../Background";
import ClassList from "./ClassList";
import AssignContentModule from "./AssignContentModule";
import AssignStudentsModule from "./AssignStudentsModule";
import firebase from "firebase/compat/app";
import { getAuth } from "firebase/auth";
import {
  getCurrentUserContext,
  getCurrentClassContext,
  getUserClassesInOrg,
  getClassesInOrg,
  getClassInfo,
  createClass,
  deleteClass,
  switchUserClass,
  ensureDefaultClass
} from "../../firebase/userDatabase";

const ClassManager = ({ width, height, firebaseApp, mainCallback }) => {
  const [classes, setClasses] = useState([]);
  const [currentClassId, setCurrentClassId] = useState(null);
  const [currentClassName, setCurrentClassName] = useState('Loading...');
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('main'); // 'main', 'assignContent', 'assignStudents'

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      
      const { orgId, role } = await getCurrentUserContext(firebaseApp);
      setCurrentOrgId(orgId);
      setCurrentUserRole(role);
      
      // Ensure Default Class exists
      if (orgId) {
        await ensureDefaultClass(orgId, firebaseApp);
      }
      
      const { classId, className } = await getCurrentClassContext(firebaseApp);
      setCurrentClassId(classId);
      setCurrentClassName(className);
      
      const auth = getAuth(firebaseApp);
      const currentUser = auth.currentUser;
      
      // Admin/Developer see all classes, others see only their classes
      let classList;
      if (role === 'Admin' || role === 'Developer') {
        console.log('Loading all classes for Admin/Developer...');
        const allClasses = await getClassesInOrg(orgId, firebaseApp);
        console.log('Raw classes from DB:', allClasses);
        classList = Object.entries(allClasses).map(([id, data]) => ({
          id,
          ...data
        }));
        console.log('Processed classList:', classList);
      } else {
        console.log('Loading user classes for Teacher/Student...');
        const userClasses = await getUserClassesInOrg(currentUser.uid, orgId, firebaseApp);
        console.log('User classes from DB:', userClasses);
        const classPromises = Object.keys(userClasses).map(async (classId) => {
          const classInfo = await getClassInfo(orgId, classId, firebaseApp);
          return { id: classId, ...classInfo };
        });
        classList = await Promise.all(classPromises);
        console.log('Processed classList:', classList);
      }
      
      console.log('Final classList to set:', classList);
      setClasses(classList);
      setLoading(false);
    } catch (error) {
      console.error('Error loading classes:', error);
      setLoading(false);
    }
  };

  const handleSwitchClass = async (classId) => {
    try {
      const auth = getAuth(firebaseApp);
      await switchUserClass(auth.currentUser.uid, currentOrgId, classId, firebaseApp);
      
      // Reload page to refresh context
      window.location.reload();
    } catch (error) {
      console.error('Error switching class:', error);
      alert('Failed to switch class');
    }
  };

  const handleCreateClass = async () => {
    try {
      const className = window.prompt('Enter class name:');
      if (!className || className.trim() === '') return;
      
      const auth = getAuth(firebaseApp);
      await createClass(currentOrgId, className.trim(), auth.currentUser.uid, firebaseApp);
      
      alert(`Class "${className}" created successfully!`);
      await loadClasses();
    } catch (error) {
      console.error('Error creating class:', error);
      alert('Failed to create class');
    }
  };

  const handleDeleteClass = async (classToDelete) => {
    try {
      if (classToDelete.isDefault) {
        alert('Cannot delete Default Class');
        return;
      }
      
      const auth = getAuth(firebaseApp);
      
      // Check permissions
      if (currentUserRole === 'Teacher') {
        // Check if user is teacher in this class
        const isTeacher = classToDelete.teachers && classToDelete.teachers[auth.currentUser.uid];
        if (!isTeacher) {
          alert('You can only delete classes where you are a teacher');
          return;
        }
      }
      
      const confirmDelete = window.confirm(`Delete class "${classToDelete.name}"? This will remove all assigned games and members.`);
      if (!confirmDelete) return;
      
      await deleteClass(currentOrgId, classToDelete.id, firebaseApp);
      
      alert('Class deleted successfully');
      await loadClasses();
    } catch (error) {
      console.error('Error deleting class:', error);
      alert('Failed to delete class: ' + error.message);
    }
  };

  const handleDeleteClassPrompt = () => {
    if (classes.length === 0) {
      alert('No classes available to delete');
      return;
    }

    // Show list of classes for deletion
    const classNames = classes.map(c => c.name).join('\n');
    const classId = prompt(
      `Select class to delete:\n\n${classNames}\n\nEnter the exact class name:`
    );
    
    if (!classId) return;

    // Find the class by name
    const classToDelete = classes.find(c => c.name === classId);
    if (!classToDelete) {
      alert('Class not found. Please enter the exact class name.');
      return;
    }

    // Use existing handleDeleteClass function
    handleDeleteClass(classToDelete);
  };

  const handleAssignContent = () => {
    setCurrentView('assignContent');
  };

  const handleAssignStudents = () => {
    setCurrentView('assignStudents');
  };

  const handleBackToMain = () => {
    setCurrentView('main');
  };

  if (loading || !currentClassName || currentClassName === 'Loading...') {
    return (
      <>
        <Background height={height} width={width} />
        <Text 
          text="Loading classes..."
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

  // Render different views based on currentView state
  if (currentView === 'assignContent') {
    return (
      <AssignContentModule
        width={width}
        height={height}
        firebaseApp={firebaseApp}
        onBack={handleBackToMain}
      />
    );
  }

  if (currentView === 'assignStudents') {
    return (
      <AssignStudentsModule
        width={width}
        height={height}
        firebaseApp={firebaseApp}
        onBack={handleBackToMain}
      />
    );
  }

  // Main view
  return (
    <>
      <Background height={height} width={width} />
      
      {/* Title */}
      <Text
        text="CLASS MANAGEMENT"
        x={width * 0.1}
        y={height * 0.05}
        style={new TextStyle({
          fontFamily: "Futura",
          fontSize: 60,
          fontWeight: 800,
          fill: [blue],
        })}
      />
      
      {/* Current Class */}
      <Text
        text={`Current Class: ${currentClassName}`}
        x={width * 0.1}
        y={height * 0.15}
        style={new TextStyle({
          fontFamily: "Arial",
          fontSize: 24,
          fontWeight: "bold",
          fill: [black],
        })}
      />
      
      {/* Management Buttons based on role */}
      {currentUserRole === 'Student' && (
        <Text
          text="Select a class to view available content"
          x={width * 0.1}
          y={height * 0.25}
          style={new TextStyle({
            fontFamily: "Arial",
            fontSize: 18,
            fill: [black],
          })}
        />
      )}
      
      {(currentUserRole === 'Teacher' || currentUserRole === 'Admin' || currentUserRole === 'Developer') && (
        <>
          <RectButton
            height={height * 0.08}
            width={width * 0.12}
            x={width * 0.5}
            y={height * 0.25}
            color={green}
            fontSize={width * 0.01}
            fontColor={white}
            text="CREATE CLASS"
            fontWeight={800}
            callback={handleCreateClass}
          />
          <RectButton
            height={height * 0.08}
            width={width * 0.12}
            x={width * 0.63}
            y={height * 0.25}
            color={blue}
            fontSize={width * 0.01}
            fontColor={white}
            text="ASSIGN GAMES"
            fontWeight={800}
            callback={handleAssignContent}
          />
          <RectButton
            height={height * 0.08}
            width={width * 0.12}
            x={width * 0.76}
            y={height * 0.25}
            color={blue}
            fontSize={width * 0.01}
            fontColor={white}
            text="ASSIGN USERS"
            fontWeight={800}
            callback={handleAssignStudents}
          />
          <RectButton
            height={height * 0.08}
            width={width * 0.12}
            x={width * 0.89}
            y={height * 0.25}
            color={red}
            fontSize={width * 0.01}
            fontColor={white}
            text="DELETE CLASS"
            fontWeight={800}
            callback={handleDeleteClassPrompt}
          />
        </>
      )}
      
      {/* Class List */}
      {console.log('ClassManager - classes:', classes, 'length:', classes?.length)}
      {classes && classes.length > 0 ? (
        <ClassList
          classes={classes}
          currentClassId={currentClassId}
          currentUserRole={currentUserRole}
          height={height * 0.5}
          width={width * 0.8}
          x={width * 0.1}
          y={height * 0.35}
          firebaseApp={firebaseApp}
          onSwitch={handleSwitchClass}
          onDelete={handleDeleteClass}
        />
      ) : (
        <Text
          text="No classes found. Create a class or contact your administrator."
          x={width * 0.1}
          y={height * 0.4}
          style={new TextStyle({
            fontFamily: "Arial",
            fontSize: 18,
            fill: [black],
          })}
        />
      )}
      
      {/* Back Button */}
      <RectButton
        height={height * 0.1}
        width={width * 0.2}
        x={width * 0.1}
        y={height * 0.85}
        color={red}
        fontSize={width * 0.012}
        fontColor={white}
        text="BACK"
        fontWeight={800}
        callback={mainCallback}
      />
    </>
  );
};

export default ClassManager;

