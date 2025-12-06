import React from 'react';
import { Container, Sprite, Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import RectButton from '../RectButton'; 
import UserManagementModule from '../../components/AdminHomeModule/UserManagementModule'
import { updateUserRoleInOrg, getUserNameFromDatabase, removeUserFromOrganization, getCurrentUserContext, isDefaultOrganization } from '../../firebase/userDatabase'
import { app } from '../../firebase/init';
import { getAuth } from 'firebase/auth';

import { green, neonGreen, black, blue, white, pink, orange, red, transparent, turquoise } from "../../utils/colors";

let currentUsername = null; // set currentUsername to null so that while the promise in getUserName() is pending, getUserName() returns null
async function getUserName(){
    const firebaseApp = app;
    const promise = getUserNameFromDatabase(firebaseApp);

    // Wait for the promise to resolve and get the username
    currentUsername = await promise;
    return currentUsername; // return the username of the current user
}

const UserObject = (props) => {
    const { width, height, x, y, username, index, role, userId, refreshUserListCallback, orgId, currentUserRole } = props;
    
    // Get current user UID
    const getCurrentUserUid = () => {
        try {
            const firebaseApp = app;
            const auth = getAuth(firebaseApp);
            return auth.currentUser?.uid;
        } catch (error) {
            console.error('Error getting current user UID:', error);
            return null;
        }
    };
    
    const currentUserUid = getCurrentUserUid();
    const isCurrentUser = currentUserUid === userId;

    const UserPermissions = {
        Admin: 'Admin',
        Developer: 'Developer',
        Teacher: 'Teacher',
        Student: 'Student',
    };

    const roleColors = {
        [UserPermissions.Admin]: red,
        [UserPermissions.Developer]: orange,
        [UserPermissions.Teacher]: blue,
        [UserPermissions.Student]: green,
    };

    // Define the order of roles (hierarchy: higher index = lower role)
    const roleOrder = [UserPermissions.Admin, UserPermissions.Developer, UserPermissions.Teacher, UserPermissions.Student];
    const roleHierarchy = {
        [UserPermissions.Admin]: 0,
        [UserPermissions.Developer]: 1,
        [UserPermissions.Teacher]: 2,
        [UserPermissions.Student]: 3
    };

    // Check if current user can change target user's role
    const canChangeRole = (targetRole) => {
        if (!currentUserRole || !targetRole) return false;
        
        const currentUserLevel = roleHierarchy[currentUserRole] ?? 999;
        const targetUserLevel = roleHierarchy[targetRole] ?? 999;
        
        // Can only change roles of users with equal or lower level (higher hierarchy number)
        return targetUserLevel >= currentUserLevel;
    };

    // Function to get the next role with proper restrictions
    const getNextRole = (currentRole) => {
        // Check if current user can change this role at all
        if (!canChangeRole(currentRole)) {
            return currentRole; // Keep current role (no change allowed)
        }
        
        // Get allowed roles for current user (only roles below or equal to current user's role)
        const currentUserLevel = roleHierarchy[currentUserRole] ?? 999;
        const allowedRoles = roleOrder.filter((role, index) => index >= currentUserLevel);
        
        // Find current role in allowed roles
        const currentIndex = allowedRoles.indexOf(currentRole);
        if (currentIndex === -1) {
            return currentRole; // Current role not in allowed list, don't change
        }
        
        // Cycle to next role in allowed list
        const nextIndex = (currentIndex + 1) % allowedRoles.length;
        return allowedRoles[nextIndex];
    };

    // Function to handle role change
    const handleChangeRole = async () => {
        try {
            if (!orgId) {
                console.error("No organization ID provided");
                return;
            }
            
            // Check if current user can change this role
            if (!canChangeRole(role)) {
                alert(`You cannot change the role of ${role}. You can only change roles equal to or below your own role (${currentUserRole}).`);
                return;
            }
            
            const nextRole = getNextRole(role);
            
            // Check if role actually changed
            if (nextRole === role) {
                alert('Role change not allowed');
                return;
            }
            
            // Double check: ensure next role is also allowed
            if (!canChangeRole(nextRole)) {
                alert(`Cannot assign role ${nextRole}. You can only assign roles equal to or below your own role (${currentUserRole}).`);
                return;
            }
            
            const firebaseApp = app;
            const result = await updateUserRoleInOrg(userId, orgId, nextRole, firebaseApp, currentUserRole);

            if (result) {
                // Success
                // Change the color of the button
                // Update the list of users
                await refreshUserListCallback();
                console.log("User role changed successfully.");
            } else {
                // Failure
                console.log("Failed to change user role.");
                alert("Failed to change user role. Please try again.");
            }
        } catch (error) {
            // Handle any errors that occurred during the operation
            console.error("Error:", error);
            alert(error.message || "An error occurred while changing the user role.");
        }
    };

    // Function to handle user deletion
    const handleDeleteUser = async () => {
        try {
            // Get Firebase app instance
            const firebaseApp = app;
            
            // Get current user to prevent self-deletion
            const auth = getAuth(firebaseApp);
            const currentUser = auth.currentUser;
            
            if (!currentUser) {
                alert("Authentication error. Please log in again.");
                return;
            }
            
            // Prevent deleting yourself
            if (currentUser.uid === userId) {
                alert("You cannot remove yourself from the organization.");
                return;
            }
            
            if (!orgId) {
                console.error("No organization ID provided");
                alert("Organization ID is missing.");
                return;
            }
            
            // Check if this is Default Organization
            const isDefault = await isDefaultOrganization(orgId, firebaseApp);
            if (isDefault) {
                alert("Cannot remove users from Default Organization.\n\nUsers can leave this organization voluntarily through the ORGANIZATIONS menu.");
                return;
            }
            
            // Show confirmation dialog
            const confirmDelete = window.confirm(
                `Are you sure you want to remove ${username} from the organization?\n\nThis action cannot be undone.`
            );
            
            if (!confirmDelete) {
                return; // User cancelled
            }
            
            // Remove user from organization
            const result = await removeUserFromOrganization(userId, orgId, firebaseApp);
            
            if (result) {
                // Success
                console.log("User removed successfully from organization.");
                alert(`${username} has been removed from the organization.`);
                await refreshUserListCallback(); // Refresh the user list
            } else {
                // Failure
                console.log("Failed to remove user from organization.");
                alert("Failed to remove user. Please try again.");
            }
        } catch (error) {
            // Handle any errors that occurred during the operation
            console.error("Error removing user:", error);
            alert("An error occurred while removing the user: " + error.message);
        }
    };

    // Calculate positions for table columns
    const userNameX = x + width * 0.05;
    const roleCenterX = x + width * 0.34; // Center of ROLE column
    const deleteCenterX = x + width * 0.7; // Center of DELETE column
    const rowCenterY = y + height * 0.5; // Vertical center of the row
    
    // Button dimensions - increased size
    const roleButtonHeight = 45;
    const roleButtonWidth = 200;
    const deleteButtonHeight = 45;
    const deleteButtonWidth = 200;
    
    return (
        <>
            {/* Username - left column */}
            <Text
                x={userNameX}
                y={rowCenterY}
                text={username}
                anchor={[0, 0]}
                style={
                    new TextStyle({
                        align: 'left',
                        fontFamily: 'Arial',
                        fontSize: 16,
                        fontWeight: 'normal',
                        fill: [black],
                    })
                }
            />
            
            {/* Role Button - center column */}
            {canChangeRole(role) && (
                <RectButton
                    height={roleButtonHeight}
                    width={roleButtonWidth}
                    x={roleCenterX}
                    y={rowCenterY}
                    color={roleColors[role]}
                    fontSize={14}
                    fontColor={white}
                    text={role}
                    fontWeight={800}
                    callback={async () => {
                        await getUserName();
                        if(username != currentUsername && currentUsername != null){ // users cannot change their own role
                            console.log("username:", username, " currentUsername:", currentUsername);
                            handleChangeRole();
                        }
                    }}
                />
            )}
            
            {/* Show "LOCKED" text if current user cannot change this role */}
            {!canChangeRole(role) && (
                <Text
                    x={roleCenterX}
                    y={rowCenterY}
                    text="LOCKED"
                    anchor={0.5}
                    style={
                        new TextStyle({
                            align: 'center',
                            fontFamily: 'Arial',
                            fontSize: 14,
                            fontWeight: 800,
                            fill: [red],
                        })
                    }
                />
            )}
                
            {/* Delete Button - right column, hide for current user */}
            {!isCurrentUser && (
                <RectButton
                    height={deleteButtonHeight}
                    width={deleteButtonWidth}
                    x={deleteCenterX}
                    y={rowCenterY}
                    color={red}
                    fontSize={14}
                    fontColor={white}
                    text={"DELETE"}
                    fontWeight={800}
                    callback={handleDeleteUser}
                />
            )}
                
            {/* Current User Indicator */}
            {isCurrentUser && (
                <Text
                    x={deleteCenterX}
                    y={rowCenterY}
                    text="(YOU)"
                    anchor={-0.25}
                    style={new TextStyle({
                        align: 'center',
                        fontFamily: 'Arial',
                        fontSize: 14,
                        fontWeight: 'bold',
                        fill: [blue],
                    })}
                />
            )}
        
        </>
    );
};

export default UserObject;
