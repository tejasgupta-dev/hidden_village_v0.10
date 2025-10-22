import React from 'react';
import { Container, Sprite, Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import RectButton from '../RectButton'; 
import UserManagementModule from '../../components/AdminHomeModule/UserManagementModule'
import { updateUserRoleInOrg, getUserNameFromDatabase, removeUserFromOrganization, getCurrentUserContext } from '../../firebase/userDatabase'
import firebase from 'firebase/compat/app';

import { green, neonGreen, black, blue, white, pink, orange, red, transparent, turquoise } from "../../utils/colors";

let currentUsername = null; // set currentUsername to null so that while the promise in getUserName() is pending, getUserName() returns null
async function getUserName(){
    const firebaseApp = firebase.app();
    const promise = getUserNameFromDatabase(firebaseApp);

    // Wait for the promise to resolve and get the username
    currentUsername = await promise;
    return currentUsername; // return the username of the current user
}

const UserObject = (props) => {
    const { width, height, x, y, username, index, role, userId, refreshUserListCallback, orgId, currentUserRole } = props;

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

    // Define the order of roles
    const roleOrder = [UserPermissions.Admin, UserPermissions.Developer, UserPermissions.Teacher, UserPermissions.Student];

    // Function to get the next role with Developer restrictions
    const getNextRole = (currentRole) => {
        // If current user is Developer, they cannot make anyone Admin
        if (currentUserRole === 'Developer') {
            // If target user is Admin, don't allow role change
            if (currentRole === 'Admin') {
                return currentRole; // Keep current role (no change allowed)
            }
            
            // For non-Admin users, cycle through: Developer -> Teacher -> Student -> Developer
            const restrictedRoleOrder = [UserPermissions.Developer, UserPermissions.Teacher, UserPermissions.Student];
            const currentIndex = restrictedRoleOrder.indexOf(currentRole);
            const nextIndex = (currentIndex + 1) % restrictedRoleOrder.length;
            return restrictedRoleOrder[nextIndex];
        }
        
        // For Admin users, allow full role cycling
        const currentIndex = roleOrder.indexOf(currentRole);
        const nextIndex = (currentIndex + 1) % roleOrder.length;
        return roleOrder[nextIndex];
    };

    // Function to handle role change
    const handleChangeRole = async () => {
        try {
            if (!orgId) {
                console.error("No organization ID provided");
                return;
            }
            
            // Check if Developer is trying to change Admin role
            if (currentUserRole === 'Developer' && role === 'Admin') {
                alert('Developers cannot modify Admin roles');
                return;
            }
            
            const nextRole = getNextRole(role);
            
            // Check if role actually changed (for Developer restrictions)
            if (nextRole === role) {
                alert('Role change not allowed');
                return;
            }
            
            const firebaseApp = firebase.app();
            const result = await updateUserRoleInOrg(userId, orgId, nextRole, firebaseApp);

            if (result) {
                // Success
                // Change the color of the button
                // Update the list of users
                await refreshUserListCallback();
                console.log("User role changed successfully.");
            } else {
                // Failure
                console.log("Failed to change user role.");
            }
        } catch (error) {
            // Handle any errors that occurred during the operation
            console.error("Error:", error);
            alert("An error occurred while changing the user role.");
        }
    };

    // Function to handle user deletion
    const handleDeleteUser = async () => {
        try {
            // Get Firebase app instance
            const firebaseApp = firebase.app();
            
            // Get current user to prevent self-deletion
            const auth = firebaseApp.auth();
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

    return (
        <>
            <Text
                x={width * 1.1}
                y={y * 1.1 + height *0.25}  // Move this line inside the style object
                text={username} //username
                style={
                    new TextStyle({
                        fontFamily: 'Futura',
                        fontSize: height/5.5,
                        fontWeight: height*4,
                    })
                }
            />
            {/* Render the Role Button only if the user is not the current user and Developer restrictions allow it */}
            {!(currentUserRole === 'Developer' && role === 'Admin') && (
                <RectButton
                    height={55}
                    width={200}
                    x={width * 5}
                    y={y * 1.1 + height *0.25}
                    color={roleColors[role]}
                    fontSize={15}
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
            
            {/* Show "LOCKED" text for Admin when viewed by Developer */}
            {currentUserRole === 'Developer' && role === 'Admin' && (
                <Text
                    x={width * 5}
                    y={y * 1.1 + height *0.25}
                    text="LOCKED"
                    style={
                        new TextStyle({
                            fontFamily: 'Futura',
                            fontSize: 15,
                            fontWeight: 800,
                            fill: [red],
                        })
                    }
                />
            )}
                
                {/* Delete Button */}
                <RectButton
                    height={55}
                    width={200}
                    x={width * 7}
                    y={y * 1.1 + height *0.25}
                    color={red}
                    fontSize={15}
                    fontColor={white}
                    text={"DELETE"}
                    fontWeight={800}
                    callback={handleDeleteUser}
                />
        
        </>
    );
};

export default UserObject;
