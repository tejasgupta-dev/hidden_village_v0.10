import React from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { blue, white, black, red, green } from "../../utils/colors";
import RectButton from "../RectButton";

const ClassObject = (props) => {
    const { width, height, x, y, classData, index, isCurrent, currentUserRole, onSwitch, onDelete, studentCount, gameCount } = props;

    if (!classData) {
        return null;
    }

    const className = classData.name || 'Unknown Class';
    const createdBy = classData.createdBy || 'Unknown';
    const isDefault = classData.isDefault || false;

    // Check if user can delete this class
    const canDelete = !isDefault && (currentUserRole === 'Admin' || currentUserRole === 'Developer' || 
        (currentUserRole === 'Teacher' && classData.teachers && classData.teachers[currentUserRole]));

    return (
        <>
            {/* Class Name */}
            <Text
                x={x}
                y={y}
                text={`${className}${isCurrent ? ' (CURRENT)' : ''}`}
                style={new TextStyle({
                    fontFamily: 'Arial',
                    fontSize: 18,
                    fontWeight: isCurrent ? 'bold' : 'normal',
                    fill: isCurrent ? [blue] : [black],
                })}
            />

            {/* Created By */}
            <Text
                x={x + width * 2.5}
                y={y}
                text={createdBy}
                style={new TextStyle({
                    fontFamily: 'Arial',
                    fontSize: 16,
                    fill: [black],
                })}
            />

            {/* Student Count */}
            <Text
                x={x + width * 4.5}
                y={y}
                text={`Students: ${studentCount || 0}`}
                style={new TextStyle({
                    fontFamily: 'Arial',
                    fontSize: 14,
                    fill: [blue],
                })}
            />

            {/* Game Count */}
            <Text
                x={x + width * 6.5}
                y={y}
                text={`Games: ${gameCount || 0}`}
                style={new TextStyle({
                    fontFamily: 'Arial',
                    fontSize: 14,
                    fill: [green],
                })}
            />

            {/* Switch Button */}
            {!isCurrent && (
                <RectButton
                    height={45}
                    width={120}
                    x={x + width * 4}
                    y={y - 5}
                    color={green}
                    fontSize={14}
                    fontColor={white}
                    text="SWITCH"
                    fontWeight={800}
                    callback={onSwitch}
                />
            )}

            {/* Current Indicator */}
            {isCurrent && (
                <Text
                    x={x + width * 4}
                    y={y}
                    text="CURRENT"
                    style={new TextStyle({
                        fontFamily: 'Arial',
                        fontSize: 16,
                        fontWeight: 'bold',
                        fill: [blue],
                    })}
                />
            )}

            {/* Delete Button (if allowed) */}
            {canDelete && !isCurrent && (
                <RectButton
                    height={45}
                    width={120}
                    x={x + width * 5.5}
                    y={y - 5}
                    color={red}
                    fontSize={14}
                    fontColor={white}
                    text="DELETE"
                    fontWeight={800}
                    callback={onDelete}
                />
            )}
        </>
    );
};

export default ClassObject;

