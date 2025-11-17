import React, { useState, useEffect } from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import RectButton from '../RectButton';
import { green, blue, white, red, orange, black } from "../../utils/colors";
import { isDefaultOrganization } from "../../firebase/userDatabase";

const OrganizationObject = (props) => {
    const { width, height, x, y, organization, index, isCurrent, onSelect, onDelete, onLeave, currentUserId, firebaseApp } = props;
    const [isDefault, setIsDefault] = useState(false);
    
    useEffect(() => {
        let isMounted = true;
        
        const checkDefault = async () => {
            if (organization?.id && firebaseApp) {
                const result = await isDefaultOrganization(organization.id, firebaseApp);
                // Only update state if component is still mounted
                if (isMounted) {
                    setIsDefault(result);
                }
            }
        };
        checkDefault();
        
        // Cleanup function to prevent state update on unmounted component
        return () => {
            isMounted = false;
        };
    }, [organization?.id, firebaseApp]);


    // Don't render if organization is not defined
    if (!organization) {
        console.log('OrganizationObject: organization is not defined, returning null');
        return null;
    }

    const roleColors = {
        'Admin': red,
        'Developer': orange,
        'Teacher': blue,
        'Student': green,
    };

    const handleSelect = () => {
        if (onSelect) {
            onSelect(organization);
        }
    };

    const isAdmin = organization.roleSnapshot === 'Admin';
    const canDelete = isAdmin && !isCurrent && !isDefault; // Cannot delete current or default organization

    // Calculate positions for table columns
    const orgNameX = x + width * 0.05;
    const switchCenterX = x + width * 0.35; // Center of SWITCH column
    const leaveCenterX = x + width * 0.6; // Center of LEAVE column
    const deleteCenterX = x + width * 0.8; // Center of DELETE column
    const rowCenterY = y + height * 0.5; // Vertical center of the row
    
    // Button dimensions - increased size
    const switchButtonHeight = 45;
    const switchButtonWidth = 150;
    const leaveButtonHeight = 45;
    const leaveButtonWidth = 120;
    const deleteButtonHeight = 45;
    const deleteButtonWidth = 120;

    return (
        <>
            {/* Organization Name - left column */}
            <Text
                x={orgNameX}
                y={rowCenterY + 8}
                text={organization?.name || 'Unknown Organization'}
                anchor={[0, 0]}
                style={
                    new TextStyle({
                        align: 'left',
                        fontFamily: 'Arial',
                        fontSize: 16,
                        fontWeight: 'normal',
                        fill: isCurrent ? [green] : [black],
                    })
                }
            />
            
            {/* Switch Button or Current Text - center column */}
            {isCurrent ? (
                <Text
                    x={switchCenterX}
                    y={rowCenterY}
                    text="current"
                    anchor={0.5}
                    style={
                        new TextStyle({
                            align: 'center',
                            fontFamily: 'Arial',
                            fontSize: 16,
                            fontWeight: 'bold',
                            fill: [green],
                        })
                    }
                />
            ) : (
                <RectButton
                    height={switchButtonHeight}
                    width={switchButtonWidth}
                    x={switchCenterX - (switchButtonWidth * 0.4) / 2}
                    y={rowCenterY - (switchButtonHeight * 0.4) / 2}
                    color={roleColors[organization.roleSnapshot] || green}
                    fontSize={14}
                    fontColor={white}
                    text="SWITCH TO"
                    fontWeight={800}
                    callback={handleSelect}
                />
            )}
            
            {/* Leave Button - right column, hide for current or default organization */}
            {!isCurrent && !isDefault && onLeave && (
                <RectButton
                    height={leaveButtonHeight}
                    width={leaveButtonWidth}
                    x={leaveCenterX - (leaveButtonWidth * 0.4) / 2}
                    y={rowCenterY - (leaveButtonHeight * 0.4) / 2}
                    color={orange}
                    fontSize={14}
                    fontColor={white}
                    text={"LEAVE"}
                    fontWeight={800}
                    callback={() => onLeave(organization)}
                />
            )}
            
            {/* Delete Button - right column, only show for Admins and non-current organizations */}
            {canDelete && onDelete && (
                <RectButton
                    height={deleteButtonHeight}
                    width={deleteButtonWidth}
                    x={deleteCenterX - (deleteButtonWidth * 0.4) / 2}
                    y={rowCenterY - (deleteButtonHeight * 0.4) / 2}
                    color={red}
                    fontSize={14}
                    fontColor={white}
                    text={"DELETE"}
                    fontWeight={800}
                    callback={() => onDelete(organization)}
                />
            )}
        </>
    );
};

export default OrganizationObject;
