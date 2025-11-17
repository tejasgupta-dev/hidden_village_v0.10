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

        // Calculate table dimensions
        const tableWidth = width;
        const tableHeight = height;
        const rowHeight = 40;
        const headerHeight = rowHeight;
        const headerY = y;
        const firstRowY = y + rowHeight;
        
        // Calculate how many users fit in the table (excluding header row)
        const availableHeight = tableHeight - headerHeight;
        const usersPerPage = Math.max(1, Math.floor(availableHeight / rowHeight));
    
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
            {/* Table Frame */}
            <Graphics
                x={x}
                y={y}
                draw={(g) => {
                    // Slightly darker yellow background (darker than yellow background)
                    g.beginFill(0xfff8dc); // cornsilk - slightly darker than yellow
                    g.drawRect(0, 0, tableWidth, tableHeight);
                    g.endFill();
                    // Black border
                    g.lineStyle(3, 0x000000, 1);
                    g.drawRect(0, 0, tableWidth, tableHeight);
                }}
            />
            
            {/* Table Headers */}
            <Text
                x={x + tableWidth * 0.05}
                y={headerY + rowHeight * 0.3}
                text={'USER'}
                style={
                    new TextStyle({
                        align: 'left',
                        fontFamily: 'Arial',
                        fontSize: 20,
                        fontWeight: 'bold',
                        fill: [black],
                    })
                }
            />
            <Text
                x={x + tableWidth * 0.35}
                y={headerY + rowHeight * 0.3}
                text={'ROLE'}
                style={
                    new TextStyle({
                        align: 'center',
                        fontFamily: 'Arial',
                        fontSize: 20,
                        fontWeight: 'bold',
                        fill: [black],
                    })
                }
            />
            <Text
                x={x + tableWidth * 0.7}
                y={headerY + rowHeight * 0.3}
                text={'DELETE'}
                style={
                    new TextStyle({
                        align: 'right',
                        fontFamily: 'Arial',
                        fontSize: 20,
                        fontWeight: 'bold',
                        fill: [black],
                    })
                }
            />
            
            {/* Header separator line */}
            <Graphics
                x={x}
                y={y + rowHeight}
                draw={(g) => {
                    g.lineStyle(2, 0x000000, 1);
                    g.moveTo(0, 0);
                    g.lineTo(tableWidth, 0);
                }}
            />
            {/* Display Users */}
            {displayedUsers.map((user, index) => {
                // Get user role from current organization context
                const userRole = user.roleInOrg || user.userRole || 'Member'; // fallback to 'Member' if no role
                
                return (
                    <UserObject
                        key={index} 
                        width={tableWidth}
                        height={rowHeight}
                        x={x}
                        y={firstRowY + (index * rowHeight)}
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
            {/* Pagination Buttons - positioned at bottom right of table */}
            <RectButton
                height={30}
                width={40}
                x={x + tableWidth - 100}
                y={y + tableHeight - 40}
                color={green}
                fontSize={20}
                fontColor={white}
                text={"<"}
                fontWeight={800}
                callback={() => {
                    handlePrevPage();
                }}
            />
            <RectButton
                height={30}
                width={40}
                x={x + tableWidth - 50}
                y={y + tableHeight - 40}
                color={green}
                fontSize={20}
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
