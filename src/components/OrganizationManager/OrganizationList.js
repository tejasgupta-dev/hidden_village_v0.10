import React, { useState } from 'react';
import { Text, Graphics } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import RectButton from '../RectButton';
import OrganizationObject from './OrganizationObject';
import { green, orange, black, white } from "../../utils/colors";

const OrganizationList = (props) => {
    const { width, height, x, y, organizations, onOrganizationSelect, currentOrgId, onOrganizationDelete, onOrganizationLeave, currentUserId, firebaseApp } = props;

    const [startIndex, setStartIndex] = useState(0);

    // Calculate table dimensions
    const tableWidth = width;
    const tableHeight = height;
    const rowHeight = 40;
    const headerHeight = rowHeight;
    const headerY = y;
    const firstRowY = y + rowHeight;
    
    // Calculate how many organizations fit in the table (excluding header row)
    const availableHeight = tableHeight - headerHeight;
    const orgsPerPage = Math.max(1, Math.floor(availableHeight / rowHeight));

    // Function to handle incrementing the start index
    const handleNextPage = () => {
        if (startIndex + orgsPerPage < organizations.length) {
            setStartIndex(startIndex + orgsPerPage);
        }
    };

    // Function to handle decrementing the start index
    const handlePrevPage = () => {
        if (startIndex - orgsPerPage >= 0) {
            setStartIndex(startIndex - orgsPerPage);
        }
    };

    // Slice the organizations based on the current start index and number of orgs per page
    const displayedOrgs = organizations ? organizations.slice(startIndex, startIndex + orgsPerPage) : [];

    // Don't render if organizations is not defined
    if (!organizations) {
        console.log('OrganizationList: organizations is not defined, returning null');
        return null;
    }

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
                text={'ORG NAME'}
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
                text={'SWITCH'}
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
                x={x + tableWidth * 0.6}
                y={headerY + rowHeight * 0.3}
                text={'LEAVE'}
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
                x={x + tableWidth * 0.8}
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
            {/* Display Organizations */}
            {displayedOrgs.map((org, index) => (
                <OrganizationObject
                    key={org.id || index}
                    width={tableWidth}
                    height={rowHeight}
                    x={x}
                    y={firstRowY + (index * rowHeight)}
                    index={index}
                    organization={org}
                    isCurrent={org.id === currentOrgId}
                    onSelect={onOrganizationSelect}
                    onDelete={onOrganizationDelete}
                    onLeave={onOrganizationLeave}
                    currentUserId={currentUserId}
                    firebaseApp={firebaseApp}
                />
            ))}
            
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
                callback={handlePrevPage}
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
                callback={handleNextPage}
            />
        </>
    );
};

export default OrganizationList;
