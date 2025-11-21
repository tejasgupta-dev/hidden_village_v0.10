import React, { useState } from 'react';
import { Text, Graphics } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import RectButton from '../RectButton';
import InviteObject from './InviteObject';
import { green, black, white } from "../../utils/colors";

const InviteList = (props) => {
    const { width, height, x, y, invites, onDelete, onCopy, deleting } = props;

    const [startIndex, setStartIndex] = useState(0);

    // Calculate table dimensions
    const tableWidth = width;
    const tableHeight = height;
    const rowHeight = 40;
    const headerHeight = rowHeight;
    const headerY = y;
    const firstRowY = y + rowHeight;
    
    // Calculate how many invites fit in the table (excluding header row)
    const availableHeight = tableHeight - headerHeight;
    const invitesPerPage = Math.max(1, Math.floor(availableHeight / rowHeight));

    // Function to handle incrementing the start index
    const handleNextPage = () => {
        if (startIndex + invitesPerPage < invites.length) {
            setStartIndex(startIndex + invitesPerPage);
        }
    };

    // Function to handle decrementing the start index
    const handlePrevPage = () => {
        if (startIndex - invitesPerPage >= 0) {
            setStartIndex(startIndex - invitesPerPage);
        }
    };

    // Slice the invites based on the current start index and number of invites per page
    const displayedInvites = invites.slice(startIndex, startIndex + invitesPerPage);

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
                text={'CODE'}
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
                x={x + tableWidth * 0.5}
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
                x={x + tableWidth * 0.66}
                y={headerY + rowHeight * 0.3}
                text={'COPY'}
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
            
            {/* Display Invites */}
            {displayedInvites.map((invite, index) => {
                return (
                    <InviteObject
                        key={invite.code} 
                        width={tableWidth}
                        height={rowHeight}
                        x={x}
                        y={firstRowY + (index * rowHeight)}
                        index={index}
                        invite={invite}
                        onDelete={onDelete}
                        onCopy={onCopy}
                        deleting={deleting === invite.code}
                    />
                );
            })}
            
            {/* Pagination Buttons - positioned at bottom right of table */}
            <RectButton
                height={height * 0.12}
                width={width * 0.1}
                x={x + tableWidth - 100}
                y={y + tableHeight - 40}
                color={startIndex > 0 ? green : 0xcccccc}
                fontSize={20}
                fontColor={white}
                text={"<"}
                fontWeight={800}
                callback={handlePrevPage}
            />
            <RectButton
                height={height * 0.12}
                width={width * 0.1}
                x={x + tableWidth - 50}
                y={y + tableHeight - 40}
                color={startIndex + invitesPerPage < invites.length ? green : 0xcccccc}
                fontSize={20}
                fontColor={white}
                text={">"}
                fontWeight={800}
                callback={handleNextPage}
            />
        </>
    );
};

export default InviteList;

