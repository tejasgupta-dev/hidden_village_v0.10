import React from 'react';
import {Container, Sprite, Text,Graphics } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import RectButton from '../RectButton';  // Replace with your actual UI library
import UserObject from './UserObject'
import { green, neonGreen, black, blue, white, pink, orange, red, transparent, turquoise } from "../../utils/colors";
import { useState } from 'react';
import { getUserNameFromDatabase } from "../../firebase/userDatabase"

async function getName(){ // Get the username of the current user
    const name = await getUserNameFromDatabase();
    return name;
}

const UserList = (props) => {
    const { width, height, x, y, users, refreshUserListCallback, orgId, currentUserRole } = props;

        const [startIndex, setStartIndex] = useState(0);

        const usersPerPage = Math.floor(height / 9);
    
        // Function to handle incrementing the start index
        const handleNextPage = () => {
            if (startIndex + usersPerPage < users.length) {
                setStartIndex(startIndex + usersPerPage);
            }
        };
    
        // Function to handle decrementing the start index
        const handlePrevPage = () => {
            if (startIndex - usersPerPage >= 0) {
                setStartIndex(startIndex - usersPerPage);
            }
        };
    
        // Slice the users based on the current start index and number of users per page
        const displayedUsers = users.slice(startIndex, startIndex + usersPerPage);

    return (
        <>
            <Graphics
                x = {width* .3}
                y = {height * 2.2}
                draw={(g) => {
                    // rectangle
                    g.beginFill(0xe0c755);
                    g.drawRect(width *0.01, height*0.01, width * 2, (  usersPerPage * 30));
                    g.endFill();
                    // border
                    g.lineStyle(4, 0x000000, 1);
                    g.drawRect(width*0.01, height*0.01, width * 2, ( usersPerPage * 30));
                }}
            />
            <Text
                x={width * .3}
                y={height * 1.5}
                text={'User'}
                style={
                    new TextStyle({
                        align: 'center',
                        fontFamily: 'Futura',
                        fontSize: 60,
                        fontWeight: 800,
                        fill: ['orange'],
                        letterSpacing: -5,
                    })
                }
            />
            <Text
                x={width * 1.5}
                y={height * 1.5}
                text={`Role`}
                style={
                    new TextStyle({
                        align: 'center',
                        fontFamily: 'Futura',
                        fontSize: 60,
                        fontWeight: 800,
                        fill: ['orange'],
                        letterSpacing: -5,
                    })
                }
            />
            {/* Display User Names */}
            {/* <ScrollView style={{ flex: 1 }}> */}
            {displayedUsers.map((user, index) => {
                // Get user role from current organization context
                const userRole = user.roleInOrg || user.userRole || 'Member'; // fallback to 'Member' if no role
                
                return (
                    <UserObject
                        key={index} 
                        width={width * .3}
                        height={height}
                        x={x}
                        y={y * 0.2 + (index + 1.2) * 25}  // Adjust the y position based on index
                        index={index}
                        username={user.userName || user.userEmail || 'Unknown'}
                        role={userRole}
                        userId = {user.userId}
                        orgId = {orgId}
                        refreshUserListCallback = {refreshUserListCallback}
                        currentUserRole={currentUserRole}
                    />
                );
            })}
            {/* // < Button // */}
            <RectButton
                height={height * .7}
                width={width * .4}
                x={width * 1.9}
                y={height*6}
                color={green}
                fontSize={width * .07}
                fontColor={white}
                text={"<"}
                fontWeight={800}
                callback={() => {
                    handlePrevPage();
                }}
            />
            {/* // > Button // */}
            <RectButton
                height={height * 0.7}
                width={width * .4}
                x={width * 2.1}
                y={height*6}
                color={green}
                fontSize={width * .07}
                fontColor={white}
                text={">"}
                fontWeight={800}
                callback={() => {
                    handleNextPage();
                }}
            />
        </>
    );
};

export default UserList;
