import React, { useState, useEffect } from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { blue, white, red, green, black, navyBlue } from "../../utils/colors";
import RectButton from "../RectButton";
import Background from "../Background";
import OrganizationList from "./OrganizationList";
import { getCurrentUserContext, getUserOrgsFromDatabase, getOrganizationInfo, findOrganizationByName, createOrganization, useInviteCode, deleteOrganization } from "../../firebase/userDatabase";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, get, set } from "firebase/database";

const OrganizationManager = ({ width, height, firebaseApp, mainCallback }) => {
  const [organizations, setOrganizations] = useState([]);
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [currentOrgName, setCurrentOrgName] = useState('Loading...');
  const [loading, setLoading] = useState(true);
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      
      // Get current user context
      const { orgId } = await getCurrentUserContext(firebaseApp);
      setCurrentOrgId(orgId);
      
      // Get user's organizations
      const auth = getAuth(firebaseApp);
      const user = auth.currentUser;
      if (!user) return;

      setCurrentUserId(user.uid);

      const userOrgs = await getUserOrgsFromDatabase(user.uid, firebaseApp);
      const orgList = [];
      
      // Get full organization data for each org
      for (const [orgId, orgData] of Object.entries(userOrgs)) {
        const orgInfo = await getOrganizationInfo(orgId, firebaseApp);
        if (orgInfo) {
          orgList.push({
            id: orgId,
            name: orgInfo.name || 'Unknown Organization',
            roleSnapshot: orgData.roleSnapshot || 'Member',
            status: orgData.status || 'active'
          });
        }
      }
      
      setOrganizations(orgList);
      
      // Set current organization name
      const currentOrg = orgList.find(org => org.id === orgId);
      setCurrentOrgName(currentOrg ? currentOrg.name : 'None');
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading organizations:', error);
      setCurrentOrgName('Error loading organizations');
      setLoading(false);
    }
  };

  const handleOrganizationSelect = async (organization) => {
    try {
      console.log('Switching to organization:', organization);
      
      // Get current user
      const auth = getAuth(firebaseApp);
      const user = auth.currentUser;
      if (!user) {
        console.error('No authenticated user');
        return;
      }
      
      // Update user's primary organization in database
      const db = getDatabase(firebaseApp);
      const userRef = ref(db, `users/${user.uid}`);
      const userSnapshot = await get(userRef);
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        userData.primaryOrgId = organization.id;
        userData.primaryOrgName = organization.name;
        userData.lastOrgSwitch = new Date().toISOString();
        
        await set(userRef, userData);
        console.log('Primary organization updated to:', organization.name);
        
        // Update current organization display
        setCurrentOrgId(organization.id);
        setCurrentOrgName(organization.name);
        
        // Show success message (optional)
        console.log('Successfully switched to organization:', organization.name);
        
        // Refresh the page to reload all data with new organization context
        window.location.reload();
      }
    } catch (error) {
      console.error('Error switching organization:', error);
    }
  };

  const handleJoinOrganization = async (inviteCode) => {
    try {
      setJoining(true);
      setJoinError(null);
      
      // Validate code
      if (!inviteCode || inviteCode.trim() === '') {
        setJoinError('Invite code cannot be empty');
        setJoining(false);
        return;
      }
      
      // Get current user
      const auth = getAuth(firebaseApp);
      const user = auth.currentUser;
      if (!user) {
        setJoinError('User not authenticated');
        setJoining(false);
        return;
      }
      
      // Use invite code to join organization
      const result = await useInviteCode(inviteCode.trim(), user.uid, firebaseApp);
      
      console.log('Successfully joined organization:', result.orgName);
      
      // Reset state
      setJoining(false);
      setJoinError(null);
      
      // Refresh organization list
      await loadOrganizations();
      
    } catch (error) {
      console.error('Error joining organization:', error);
      setJoinError(error.message || 'Failed to join organization');
      setJoining(false);
    }
  };

  const handleDeleteOrganization = async (organization) => {
    try {
      // Prevent deleting current organization
      if (organization.id === currentOrgId) {
        alert('Cannot delete your current organization. Please switch to another organization first.');
        return;
      }
      
      // Get member count
      const orgInfo = await getOrganizationInfo(organization.id, firebaseApp);
      const memberCount = orgInfo.members ? Object.keys(orgInfo.members).length : 0;
      
      // Show confirmation with warning
      const confirmMessage = `WARNING: This action cannot be undone!\n\n` +
        `You are about to DELETE "${organization.name}".\n\n` +
        `This will:\n` +
        `- Remove ${memberCount} member(s) from this organization\n` +
        `- Delete all levels and games\n` +
        `- Remove all organization data\n\n` +
        `Type the organization name to confirm: ${organization.name}`;
      
      const userInput = window.prompt(confirmMessage);
      
      if (userInput !== organization.name) {
        if (userInput !== null) {
          alert('Organization name does not match. Deletion cancelled.');
        }
        return;
      }
      
      // Delete organization
      await deleteOrganization(organization.id, firebaseApp);
      
      alert(`Organization "${organization.name}" has been deleted successfully.`);
      
      // Reload organizations list
      await loadOrganizations();
    } catch (error) {
      console.error('Error deleting organization:', error);
      alert(`Failed to delete organization: ${error.message}`);
    }
  };

  const handleCreateOrganization = async (orgName) => {
    try {
      setCreating(true);
      setCreateError(null);
      
      // Validate name
      if (!orgName || orgName.trim() === '') {
        setCreateError('Organization name cannot be empty');
        setCreating(false);
        return;
      }
      
      // Check if organization with this name already exists
      const existingOrgId = await findOrganizationByName(orgName.trim(), firebaseApp);
      if (existingOrgId) {
        setCreateError('Organization with this name already exists');
        setCreating(false);
        return;
      }
      
      // Get current user
      const auth = getAuth(firebaseApp);
      const user = auth.currentUser;
      if (!user) {
        setCreateError('User not authenticated');
        setCreating(false);
        return;
      }
      
      // Create organization (user is automatically added as Admin)
      await createOrganization(orgName.trim(), user.uid, firebaseApp);
      
      // Reset state
      setCreating(false);
      setCreateError(null);
      
      // Refresh organization list
      await loadOrganizations();
      
    } catch (error) {
      console.error('Error creating organization:', error);
      setCreateError('Failed to create organization');
      setCreating(false);
    }
  };



  // Don't render if still loading or critical data is missing
  if (loading || !currentOrgName || currentOrgName === 'Loading...') {
    console.log('OrganizationManager: Still loading or currentOrgName is missing, showing loading screen');
    return (
      <>
        <Background height={height * 1.1} width={width} />
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

  return (
    <>
      <Background height={height * 1.1} width={width} />
      
      {/* Title */}
      <Text
        text="Organization Manager"
        x={width * 0.12}
        y={height * 0.01}
        style={new TextStyle({
          align: "center",
          fontFamily: "Futura",
          fontSize: 80,
          fontWeight: 800,
          fill: [blue],
          letterSpacing: -5,
        })}
      />
      
      {/* Organizations List */}
      {organizations.length > 0 && (
        <OrganizationList 
          organizations={organizations} 
          height={height * 0.12}
          width={width * 0.26}
          x={width * 0.4}
          y={height * 1}
          currentOrgId={currentOrgId}
          onOrganizationSelect={handleOrganizationSelect}
          onOrganizationDelete={handleDeleteOrganization}
          currentUserId={currentUserId}
        />
      )}
      
      {/* Current Organization */}
      <Text
        text={`Current Organization: ${currentOrgName || 'Loading...'}`}
        x={width * 0.1}
        y={height * 0.2}
        style={new TextStyle({
          align: "left",
          fontFamily: "Arial",
          fontSize: 24,
          fontWeight: "bold",
          fill: [green],
        })}
      />
      
      {/* Join Organization Button */}
      <RectButton
        height={height * 0.13}
        width={width * 0.26}
        x={width * 0.7}
        y={height * 0.2}
        color={blue}
        fontSize={width * 0.012}
        fontColor={white}
        text={joining ? "JOINING..." : "JOIN ORGANIZATION"}
        fontWeight={800}
        callback={async () => {
          const inviteCode = window.prompt('Enter invite code:');
          if (inviteCode) {
            await handleJoinOrganization(inviteCode);
          }
        }}
      />
      
      {/* Create New Organization Button - Available for all users */}
      <RectButton
        height={height * 0.13}
        width={width * 0.26}
        x={width * 0.7}
        y={height * 0.35}
        color={green}
        fontSize={width * 0.012}
        fontColor={white}
        text={creating ? "CREATING..." : "CREATE NEW ORGANIZATION"}
        fontWeight={800}
        callback={async () => {
          const orgName = window.prompt('Enter organization name:');
          if (orgName) {
            await handleCreateOrganization(orgName);
          }
        }}
      />
      
      {/* Join Error Message */}
      {joinError && (
        <Text
          text={joinError}
          x={width * 0.1}
          y={height * 0.35}
          style={new TextStyle({
            align: "left",
            fontFamily: "Arial",
            fontSize: 18,
            fontWeight: "bold",
            fill: [red],
          })}
        />
      )}
      
      {/* Create Error Message */}
      {createError && (
        <Text
          text={createError}
          x={width * 0.1}
          y={height * 0.5}
          style={new TextStyle({
            align: "left",
            fontFamily: "Arial",
            fontSize: 18,
            fontWeight: "bold",
            fill: [red],
          })}
        />
      )}
      
      {/* Refresh Button */}
      <RectButton
        height={height * 0.13}
        width={width * 0.4}
        x={width * 0.4}
        y={height * 0.85}
        color={navyBlue} 
        fontSize={width * 0.015}
        fontColor={white} 
        text={loading ? "REFRESHING..." : "REFRESH ORGANIZATIONS"}
        fontWeight={800}
        callback={loadOrganizations}
      />
      
      {/* Back Button */}
      <RectButton
        height={height * 0.13}
        width={width * 0.26}
        x={width * 0.15}
        y={height * 0.85}
        color={red}
        fontSize={width * 0.015}
        fontColor={white}
        text="BACK"
        fontWeight={800}
        callback={mainCallback}
      />
    </>
  );
};

export default OrganizationManager;