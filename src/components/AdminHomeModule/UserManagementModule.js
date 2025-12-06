// USED FOR TESTING THE CONJECTURES THAT WE UPLOAD
import Background from "../Background";
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { green, neonGreen, black, blue, white, pink, orange, red, transparent, turquoise, purple, navyBlue, royalBlue, dodgerBlue, powderBlue, midnightBlue, steelBlue, cornflowerBlue, yellow } from "../../utils/colors";
import Button from "../Button";
import RectButton from "../RectButton";
import { getConjectureDataByUUIDWithCurrentOrg } from "../../firebase/database";
import {getUsersByOrganizationFromDatabase, getCurrentUserContext, getCurrentUserOrgInfo} from "../../firebase/userDatabase";

import UserList from './UserList';


import React, { useState, useEffect, useRef } from 'react';
import NewUserModule from "./NewUserModule";



const UserManagementModule = (props) => {
    const { height, width, firebaseApp, mainCallback, addNewUserCallback, onOrganizationsClick, onClassesClick } = props;
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentOrgId, setCurrentOrgId] = useState(null);
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [currentOrgName, setCurrentOrgName] = useState('Loading...');
    
    // Track if component is mounted to prevent state updates on unmounted component
    const isMountedRef = useRef(true);

    const refreshUserList = async () => {
        try {
            if (isMountedRef.current) {
                setLoading(true);
            }

            /* 1.  fetch org (may be null for brand-new users) */
            const { orgId, role } = await getCurrentUserContext(firebaseApp);
            
            // Check if component is still mounted before continuing
            if (!isMountedRef.current) return;
            
            if (!orgId) {
                console.warn('No organization found for current user');
                if (isMountedRef.current) {
                    setUsersList([]);
                }
                return;
            }
            
            if (isMountedRef.current) {
                setCurrentOrgId(orgId);
                setCurrentUserRole(role);
            }
            
            /* 2.  fetch organization name */
            const orgInfo = await getCurrentUserOrgInfo(firebaseApp);
            
            // Check if component is still mounted before continuing
            if (!isMountedRef.current) return;
            
            if (orgInfo && orgInfo.orgName && isMountedRef.current) {
                setCurrentOrgName(orgInfo.orgName);
            }
            
            /* 3.  fetch users – returns [] on empty org */
            const users = await getUsersByOrganizationFromDatabase(orgId, firebaseApp);
            
            // Check if component is still mounted before updating state
            if (!isMountedRef.current) return;
            
            console.log('User 0:', users.length ? users[0] : 'none');
            if (isMountedRef.current) {
                setUsersList(users);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }

    useEffect(() => {
        isMountedRef.current = true;
        refreshUserList();
        
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const handleEdit = (user) => {
        // Handle edit action for the user
        console.log('Editing user:', user);
        };
        
        const handleDelete = (user) => {
            // Handle delete action for the user
            console.log('Deleting user:', user);
        };

    return(
    <>
        < Background height={height} width={width} />
        {/*Ttile*/}
        <Text
            text={`User Management`}
            x={width * .12}
            y={height * 0.01}
            style={
            new TextStyle({
                align: "center",
                fontFamily: "Futura",
                fontSize: width * 0.06,
                fontWeight: 800,
                fill: [blue],
                letterSpacing: -5,
            })
            }
        />
        {/* Current Organization */}
        <Text
            text={`CURRENT ORGANIZATION: ${currentOrgName}`}
            x={width * 0.12}
            y={height * 0.15}
            style={
            new TextStyle({
                align: "left",
                fontFamily: "Arial",
                fontSize: width * 0.016,
                fontWeight: "bold",
                fill: [black],
            })
            }
        />
        {/* Display Users only if usersList is not null */}
        {usersList.length !== 0 && (
            <UserList 
                users={usersList} 
                height={height * 0.5}
                width={width * 0.5}
                x={width * 0.1}
                y={height * 0.25}
                orgId={currentOrgId}
                refreshUserListCallback = {refreshUserList}
                currentUserRole={currentUserRole}
            />
        )}

        {/* Bottom Navigation Buttons */}
        <RectButton
            height={height * 0.08}
            width={width * 0.2}
            x={width * 0.1}
            y={height * 0.88}
            color={green}
            fontSize={width * 0.012}
            fontColor={white}
            text={"ORG"}
            fontWeight={800}
            callback={onOrganizationsClick || (() => {})}
        />
        
        {onClassesClick && (
            <RectButton
                height={height * 0.08}
                width={width * 0.2}
                x={width * 0.45}
                y={height * 0.88}
                color={green}
                fontSize={width * 0.012}
                fontColor={white}
                text={"CLASSES"}
                fontWeight={800}
                callback={onClassesClick}
            />
        )}
        
        <RectButton
            height={height * 0.08}
            width={width * 0.2}
            x={width * 0.8}
            y={height * 0.88}
            color={red}
            fontSize={width * 0.012}
            fontColor={white}
            text={"BACK"}
            fontWeight={800}
            callback={mainCallback}
        />
    </>
    );
};

export default UserManagementModule;