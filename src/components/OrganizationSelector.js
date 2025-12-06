import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { green, blue, red, white, black } from "../utils/colors";
import RectButton from "./RectButton";
import Background from "./Background";
import { getUserOrgsFromDatabase, getOrganizationInfo, getCurrentUserContext, refreshUserContext } from "../firebase/userDatabase";
import { app } from "../firebase/init";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, update } from "firebase/database";

const OrganizationSelector = ({ width, height, onOrganizationSelected }) => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const isMountedRef = useRef(true);
  const firebaseApp = app;

  const loadUserOrganizations = useCallback(async () => {
    try {
      if (!isMountedRef.current) return;
      setLoading(true);
      setError(null);
      
      const auth = getAuth(firebaseApp);
      const user = auth.currentUser;
      
      if (!user) {
        if (!isMountedRef.current) return;
        setError('User not authenticated');
        setLoading(false);
        return;
      }
      
      // Get user's organizations
      const userOrgs = await getUserOrgsFromDatabase(user.uid, firebaseApp);
      const orgIds = Object.keys(userOrgs);
      
      if (!isMountedRef.current) return;
      
      if (orgIds.length === 0) {
        setError('You are not a member of any organization');
        setLoading(false);
        return;
      }
      
      // Get organization details
      const orgPromises = orgIds.map(async (orgId) => {
        const orgInfo = await getOrganizationInfo(orgId, firebaseApp);
        return {
          id: orgId,
          name: orgInfo.name,
          role: userOrgs[orgId].roleSnapshot || 'Member'
        };
      });
      
      const orgsWithDetails = await Promise.all(orgPromises);
      
      if (!isMountedRef.current) return;
      setOrganizations(orgsWithDetails);
      
    } catch (err) {
      console.error('Error loading organizations:', err);
      if (!isMountedRef.current) return;
      setError('Failed to load organizations');
    } finally {
      if (!isMountedRef.current) return;
      setLoading(false);
    }
  }, [firebaseApp]);

  useEffect(() => {
    loadUserOrganizations();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadUserOrganizations]);

  const handleSelectOrganization = async (orgId) => {
    try {
      if (!isMountedRef.current) return;
      setSelecting(true);
      
      const auth = getAuth(firebaseApp);
      const user = auth.currentUser;
      
      if (!user) {
        if (!isMountedRef.current) return;
        alert('User not authenticated');
        setSelecting(false);
        return;
      }
      
      // Update user's primary organization
      const db = getDatabase(firebaseApp);
      await update(ref(db, `users/${user.uid}`), {
        primaryOrgId: orgId,
        lastOrgSwitch: new Date().toISOString()
      });
      
      console.log('Primary organization updated:', orgId);
      
      // Refresh user context and call callback
      await refreshUserContext(firebaseApp);
      if (onOrganizationSelected) {
        onOrganizationSelected();
      }
      
    } catch (err) {
      console.error('Error selecting organization:', err);
      if (!isMountedRef.current) return;
      alert('Failed to select organization: ' + err.message);
      setSelecting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Background width={width} height={height} />
        <Text
          text="Loading organizations..."
          x={width * 0.5}
          y={height * 0.5}
          style={new TextStyle({
            align: "center",
            fontFamily: "Arial",
            fontSize: 24,
            fontWeight: "bold",
            fill: [white],
          })}
        />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Background width={width} height={height} />
        
        {/* Title */}
        <Text
          text="ORGANIZATION SELECTION"
          x={width * 0.5}
          y={height * 0.1}
          style={new TextStyle({
            align: "center",
            fontFamily: "Arial",
            fontSize: 32,
            fontWeight: "bold",
            fill: [white],
          })}
        />

        {/* Error Message */}
        <Text
          text={error}
          x={width * 0.5}
          y={height * 0.5}
          style={new TextStyle({
            align: "center",
            fontFamily: "Arial",
            fontSize: 20,
            fontWeight: "bold",
            fill: [red],
          })}
        />

        {/* Refresh Button */}
        <RectButton
          height={height * 0.08}
          width={width * 0.2}
          x={width * 0.4}
          y={height * 0.7}
          color={blue}
          fontSize={width * 0.012}
          fontColor={white}
          text="REFRESH"
          fontWeight={800}
          callback={loadUserOrganizations}
        />
      </>
    );
  }

  return (
    <>
      <Background width={width} height={height} />
      
      {/* Title */}
      <Text
        text="SELECT ORGANIZATION"
        x={width * 0.5}
        y={height * 0.1}
        style={new TextStyle({
          align: "center",
          fontFamily: "Arial",
          fontSize: 32,
          fontWeight: "bold",
          fill: [white],
        })}
      />

      {/* Subtitle */}
      <Text
        text="Choose an organization to continue:"
        x={width * 0.5}
        y={height * 0.2}
        style={new TextStyle({
          align: "center",
          fontFamily: "Arial",
          fontSize: 18,
          fill: [white],
        })}
      />

      {/* Organizations List */}
      {organizations.map((org, index) => (
        <OrganizationItem
          key={org.id}
          organization={org}
          index={index}
          width={width}
          height={height}
          onSelect={handleSelectOrganization}
          selecting={selecting}
        />
      ))}
    </>
  );
};

const OrganizationItem = ({ organization, index, width, height, onSelect, selecting }) => {
  const yPosition = height * 0.35 + (index * height * 0.15);
  
  return (
    <>
      {/* Organization Name */}
      <Text
        text={organization.name}
        x={width * 0.1}
        y={yPosition}
        style={new TextStyle({
          align: "left",
          fontFamily: "Arial",
          fontSize: 20,
          fontWeight: "bold",
          fill: [white],
        })}
      />

      {/* Role */}
      <Text
        text={`Role: ${organization.role}`}
        x={width * 0.1}
        y={yPosition + 30}
        style={new TextStyle({
          align: "left",
          fontFamily: "Arial",
          fontSize: 16,
          fill: [green],
        })}
      />

      {/* Select Button */}
      <RectButton
        height={height * 0.08}
        width={width * 0.2}
        x={width * 0.7}
        y={yPosition}
        color={selecting ? red : blue}
        fontSize={width * 0.012}
        fontColor={white}
        text={selecting ? "SELECTING..." : "SELECT"}
        fontWeight={800}
        callback={() => onSelect(organization.id)}
      />
    </>
  );
};

export default OrganizationSelector;
