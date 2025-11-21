import React, { useState, useEffect } from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { green, blue, red, white, black } from "../../utils/colors";
import RectButton from "../RectButton";
import Background from "../Background";
import { getInvitesForOrganization, deleteInviteCode } from "../../firebase/userDatabase";

const InviteListModule = ({ width, height, firebaseApp, currentOrgId, onBack }) => {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (currentOrgId) {
      loadInvites();
    }
  }, [currentOrgId]);

  const loadInvites = async () => {
    try {
      setLoading(true);
      setError(null);
      const invitesList = await getInvitesForOrganization(currentOrgId, firebaseApp);
      setInvites(invitesList);
    } catch (err) {
      console.error('Error loading invites:', err);
      setError('Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvite = async (code) => {
    try {
      setDeleting(code);
      await deleteInviteCode(code, firebaseApp);
      await loadInvites(); // Refresh the list
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
      <Background width={width} height={height} />
      
      {/* Title */}
      <Text
        text="INVITE CODES MANAGEMENT"
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

      {/* Back Button */}
      <RectButton
        height={height * 0.08}
        width={width * 0.15}
        x={width * 0.05}
        y={height * 0.05}
        color={red}
        fontSize={width * 0.012}
        fontColor={white}
        text="BACK"
        fontWeight={800}
        callback={onBack}
      />

      {/* Refresh Button */}
      <RectButton
        height={height * 0.08}
        width={width * 0.15}
        x={width * 0.8}
        y={height * 0.05}
        color={blue}
        fontSize={width * 0.012}
        fontColor={white}
        text="REFRESH"
        fontWeight={800}
        callback={loadInvites}
      />

      {/* Error Message */}
      {error && (
        <Text
          text={error}
          x={width * 0.1}
          y={height * 0.2}
          style={new TextStyle({
            align: "left",
            fontFamily: "Arial",
            fontSize: 18,
            fontWeight: "bold",
            fill: [red],
          })}
        />
      )}

      {/* Invites List */}
      {invites.length === 0 ? (
        <Text
          text="No active invite codes"
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
      ) : (
        invites.map((invite, index) => (
          <InviteItem
            key={invite.code}
            invite={invite}
            index={index}
            width={width}
            height={height}
            onDelete={handleDeleteInvite}
            onCopy={handleCopyCode}
            deleting={deleting === invite.code}
          />
        ))
      )}
    </>
  );
};

const InviteItem = ({ invite, index, width, height, onDelete, onCopy, deleting }) => {
  const yPosition = height * 0.25 + (index * height * 0.12);
  
  return (
    <>
      {/* Invite Code */}
      <Text
        text={`Code: ${invite.code}`}
        x={width * 0.1}
        y={yPosition}
        style={new TextStyle({
          align: "left",
          fontFamily: "Arial",
          fontSize: 16,
          fontWeight: "bold",
          fill: [white],
        })}
      />

      {/* Role */}
      <Text
        text={`Role: ${invite.role}`}
        x={width * 0.1}
        y={yPosition + 25}
        style={new TextStyle({
          align: "left",
          fontFamily: "Arial",
          fontSize: 14,
          fill: [green],
        })}
      />

      {/* Created Date */}
      <Text
        text={`Created: ${new Date(invite.createdAt).toLocaleDateString()}`}
        x={width * 0.1}
        y={yPosition + 45}
        style={new TextStyle({
          align: "left",
          fontFamily: "Arial",
          fontSize: 12,
          fill: [white],
        })}
      />

      {/* Copy Button */}
      <RectButton
        height={height * 0.06}
        width={width * 0.12}
        x={width * 0.6}
        y={yPosition}
        color={blue}
        fontSize={width * 0.01}
        fontColor={white}
        text="COPY"
        fontWeight={800}
        callback={() => onCopy(invite.code)}
      />

      {/* Delete Button */}
      <RectButton
        height={height * 0.06}
        width={width * 0.12}
        x={width * 0.75}
        y={yPosition}
        color={deleting ? red : red}
        fontSize={width * 0.01}
        fontColor={white}
        text={deleting ? "DELETING..." : "DELETE"}
        fontWeight={800}
        callback={() => onDelete(invite.code)}
      />
    </>
  );
};

export default InviteListModule;
