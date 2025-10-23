import React from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import RectButton from '../RectButton';
import { green, blue, white, red, orange, black } from "../../utils/colors";

const OrganizationObject = (props) => {
    const { width, height, x, y, organization, index, isCurrent, onSelect, onDelete, onLeave, currentUserId } = props;


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
    const canDelete = isAdmin && !isCurrent; // Cannot delete current organization

    return (
        <>
            <Text
                x={width * 1.1}
                y={y * 1.1 + height * 0.25}
                text={organization?.name || 'Unknown Organization'}
                style={
                    new TextStyle({
                        fontFamily: 'Futura',
                        fontSize: height / 5.5,
                        fontWeight: height * 4,
                        fill: isCurrent ? [green] : [black],
                    })
                }
            />
            <RectButton
                height={55}
                width={200}
                x={width * 5}
                y={y * 1.1 + height * 0.25}
                color={roleColors[organization.roleSnapshot] || green}
                fontSize={15}
                fontColor={white}
                text={isCurrent ? 'CURRENT' : 'SWITCH TO'}
                fontWeight={800}
                callback={handleSelect}
            />
            {/* Delete button - only show for Admins and non-current organizations */}
            {canDelete && onDelete && (
                <RectButton
                    height={55}
                    width={150}
                    x={width * 7}
                    y={y * 1.1 + height * 0.25}
                    color={red}
                    fontSize={15}
                    fontColor={white}
                    text={"DELETE"}
                    fontWeight={800}
                    callback={() => onDelete(organization)}
                />
            )}
            {/* Leave button - always show except for current organization */}
            {!isCurrent && onLeave && (
                <RectButton
                    height={55}
                    width={150}
                    x={width * (canDelete ? 8.5 : 7)}
                    y={y * 1.1 + height * 0.25}
                    color={orange}
                    fontSize={15}
                    fontColor={white}
                    text={"LEAVE"}
                    fontWeight={800}
                    callback={() => onLeave(organization)}
                />
            )}
            {/* Current indicator */}
            {isCurrent && (
                <Text
                    x={width * 7.5}
                    y={y * 1.1 + height * 0.25}
                    text="(CURRENT)"
                    style={
                        new TextStyle({
                            fontFamily: 'Futura',
                            fontSize: 12,
                            fontWeight: 800,
                            fill: [green],
                        })
                    }
                />
            )}
        </>
    );
};

export default OrganizationObject;
