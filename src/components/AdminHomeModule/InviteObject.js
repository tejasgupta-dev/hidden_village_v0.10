import React from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import RectButton from '../RectButton';
import { blue, red, white, black } from "../../utils/colors";

const InviteObject = (props) => {
    const { width, height, x, y, invite, onDelete, onCopy, deleting } = props;
    
    // Calculate positions for table columns
    const codeX = x + width * 0.05;
    const roleCenterX = x + width * 0.5; // Center of ROLE column
    const copyCenterX = x + width * 0.65; // Center of COPY column (between 0.6 and 0.8)
    const deleteCenterX = x + width * 0.8; // Center of DELETE column
    const rowCenterY = y + height * 0.5; // Vertical center of the row
    
    // Button dimensions
    const copyButtonHeight = 45;
    const copyButtonWidth = 200;
    const deleteButtonHeight = 45;
    const deleteButtonWidth = 200;
    
    return (
        <>
            {/* Invite Code - left column */}
            <Text
                x={codeX}
                y={rowCenterY}
                text={invite.code}
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
            
            {/* Role - center column */}
            <Text
                x={roleCenterX}
                y={rowCenterY}
                text={invite.role}
                anchor={0.0}
                style={
                    new TextStyle({
                        align: 'center',
                        fontFamily: 'Arial',
                        fontSize: 16,
                        fontWeight: 'normal',
                        fill: [black],
                    })
                }
            />
            
            {/* Copy Button - center column */}
            <RectButton
                height={copyButtonHeight}
                width={copyButtonWidth}
                x={copyCenterX}
                y={rowCenterY}
                color={blue}
                fontSize={14}
                fontColor={white}
                text="COPY"
                fontWeight={800}
                callback={() => onCopy(invite.code)}
            />
            
            {/* Delete Button - right column */}
            <RectButton
                height={deleteButtonHeight}
                width={deleteButtonWidth}
                x={deleteCenterX}
                y={rowCenterY}
                color={red}
                fontSize={14}
                fontColor={white}
                text={deleting ? "DELETING..." : "DELETE"}
                fontWeight={800}
                callback={() => onDelete(invite.code)}
            />
        </>
    );
};

export default InviteObject;

