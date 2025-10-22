import React from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import RectButton from '../RectButton';
import { green, blue, white, red, orange, black } from "../../utils/colors";

const OrganizationObject = (props) => {
    const { width, height, x, y, organization, index, isCurrent, onSelect } = props;


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
