import React, { useState, useEffect } from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { green, blue, red, white, black, yellow } from "../../utils/colors";
import RectButton from "../RectButton";
import Background from "../Background";
import InviteList from "./InviteList";
import { getInvitesForOrganization, deleteInviteCode, generateInviteCode, getCurrentUserContext } from "../../firebase/userDatabase";
import { getAuth } from "firebase/auth";

const InviteManagementModule = ({ width, height, firebaseApp, onBack }) => {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [currentOrgName, setCurrentOrgName] = useState('Loading...');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current user context
      const userContext = await getCurrentUserContext(firebaseApp);
      if (!userContext || !userContext.orgId) {
        setError('No organization found');
        setLoading(false);
        return;
      }
      
      setCurrentOrgId(userContext.orgId);
      setCurrentOrgName(userContext.orgName || 'Unknown Organization');
      
      // Load invites
      const invitesList = await getInvitesForOrganization(userContext.orgId, firebaseApp);
      setInvites(invitesList);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvite = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      if (!currentOrgId) {
        setError('No organization selected');
        setGenerating(false);
        return;
      }
      
      // Prompt for role selection
      const role = window.prompt('Enter role for invite (Admin/Developer/Teacher/Student):');
      if (!role) return;
      
      // Validate role
      const validRoles = ['Admin', 'Developer', 'Teacher', 'Student'];
      if (!validRoles.includes(role)) {
        setError('Invalid role. Must be one of: Admin, Developer, Teacher, Student');
        setGenerating(false);
        return;
      }
      
      // Get current user UID
      const auth = getAuth(firebaseApp);
      const user = auth.currentUser;
      if (!user) {
        setError('User not authenticated');
        setGenerating(false);
        return;
      }
      
      // Generate invite code
      const inviteCode = await generateInviteCode(currentOrgId, role, user.uid, firebaseApp);
      
      // Refresh invites list
      await loadData();
      
      // Show success message
      alert(`Invite code generated successfully!\n\nCode: ${inviteCode}\n\nRole: ${role}\n\nOrganization: ${currentOrgName}`);
      
    } catch (err) {
      console.error('Error generating invite code:', err);
      setError('Failed to generate invite code: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteInvite = async (code) => {
    try {
      setDeleting(code);
      await deleteInviteCode(code, firebaseApp);
      await loadData(); // Refresh the list
    } catch (err) {
      console.error('Error deleting invite:', err);
      setError('Failed to delete invite');
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      alert('Invite code copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Invite code copied to clipboard!');
    });
  };

  if (loading) {
    return (
      <>
        <Background width={width} height={height} />
        <Text
          text="Loading invites..."
          x={width * 0.5}
          y={height * 0.5}
          style={new TextStyle({
            align: "center",
            fontFamily: "Arial",
            fontSize: width * 0.018,
            fontWeight: "bold",
            fill: [white],
          })}
        />
      </>
    );
  }

  return (
    <>
      <Background width={width} height={height} />
      
      {/* Title */}
      <Text
        text="INVITE CODE MANAGEMENT"
        x={width * 0.12}
        y={height * 0.01}
        style={new TextStyle({
          align: "left",
          fontFamily: "Futura",
          fontSize: width * 0.06,
          fontWeight: 800,
          fill: [blue],
          letterSpacing: -5,
        })}
      />

      {/* Current Organization */}
      <Text
        text={`CURRENT ORGANIZATION: ${currentOrgName}`}
        x={width * 0.12}
        y={height * 0.12}
        style={new TextStyle({
          align: "left",
          fontFamily: "Arial",
          fontSize: width * 0.018,
          fontWeight: "bold",
          fill: [black],
        })}
      />

      {/* Invites List */}
      {invites.length > 0 && (
        <InviteList 
          invites={invites} 
          height={height * 0.5}
          width={width * 0.5}
          x={width * 0.1}
          y={height * 0.25}
          onDelete={handleDeleteInvite}
          onCopy={handleCopyCode}
          deleting={deleting}
        />
      )}

      {/* Generate Invite Button */}
      <RectButton
        height={height * 0.12}
        width={width * 0.3}
        x={width * 0.65}
        y={height * 0.25}
        color={green}
        fontSize={width * 0.012}
        fontColor={white}
        text={generating ? "GENERATING..." : "GENERATE INVITE"}
        fontWeight={800}
        callback={handleGenerateInvite}
      />

      {/* Back Button */}
      <RectButton
        height={height * 0.08}
        width={width * 0.2}
        x={width * 0.8}
        y={height * 0.88}
        color={red}
        fontSize={width * 0.015}
        fontColor={white}
        text="BACK"
        fontWeight={800}
        callback={onBack}
      />
    </>
  );
};

export default InviteManagementModule;
