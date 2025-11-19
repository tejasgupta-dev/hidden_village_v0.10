import React from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { blue, white, black, red, green } from "../../utils/colors";
import RectButton from "../RectButton";

const ClassObject = (props) => {
    const { width, height, x, y, classData, index, isCurrent, currentUserRole, onSwitch, onDelete, studentCount, gameCount, creatorEmail } = props;

    if (!classData) {
        return null;
    }

    const className = classData.name || 'Unknown Class';
    const createdBy = creatorEmail || 'Unknown';
    const isDefault = classData.isDefault || false;

    // Check if user can delete this class
    const canDelete = !isDefault && (currentUserRole === 'Admin' || currentUserRole === 'Developer' || 
        (currentUserRole === 'Teacher' && classData.teachers && classData.teachers[currentUserRole]));

    // Calculate positions for table columns
    const classNameX = x + width * 0.05;
    const createdByX = x + width * 0.25;
    const studentsCenterX = x + width * 0.43;
    const gamesCenterX = x + width * 0.53;
    const switchCenterX = x + width * 0.65;
    const deleteCenterX = x + width * 0.8;
    const rowCenterY = y + height * 0.5; // Vertical center of the row
    
    // Button dimensions - increased size
    const switchButtonHeight = 45;
    const switchButtonWidth = 200;
    const deleteButtonHeight = 45;
    const deleteButtonWidth = 200;

    return (
        <>
            {/* Class Name - left column */}
            <Text
                x={classNameX}
                y={rowCenterY + 8}
                text={className}
                anchor={[0, 0]}
                style={new TextStyle({
                    align: 'left',
                    fontFamily: 'Arial',
                    fontSize: 16,
                    fontWeight: 'normal',
                    fill: isCurrent ? [green] : [black],
                })}
            />

            {/* Created By - second column */}
            <Text
                x={createdByX}
                y={rowCenterY + 8}
                text={createdBy}
                anchor={[0, 0]}
                style={new TextStyle({
                    align: 'left',
                    fontFamily: 'Arial',
                    fontSize: 16,
                    fill: [black],
                })}
            />

            {/* Student Count - third column */}
            <Text
                x={studentsCenterX}
                y={rowCenterY}
                text={`${studentCount || 0}`}
                anchor={-0.25}
                style={new TextStyle({
                    align: 'center',
                    fontFamily: 'Arial',
                    fontSize: 16,
                    fill: [black],
                })}
            />

            {/* Game Count - fourth column */}
            <Text
                x={gamesCenterX}
                y={rowCenterY}
                text={`${gameCount || 0}`}
                anchor={-0.25}
                style={new TextStyle({
                    align: 'center',
                    fontFamily: 'Arial',
                    fontSize: 16,
                    fill: [black],
                })}
            />

            {/* Switch Button or Current Text - fifth column */}
            {isCurrent ? (
                <Text
                    x={switchCenterX}
                    y={rowCenterY}
                    text="  current"
                    anchor={0.0}
                    style={new TextStyle({
                        align: 'center',
                        fontFamily: 'Arial',
                        fontSize: 16,
                        fontWeight: 'bold',
                        fill: [green],
                    })}
                />
            ) : (
                <RectButton
                    height={switchButtonHeight}
                    width={switchButtonWidth}
                    x={switchCenterX}
                    y={rowCenterY}
                    color={green}
                    fontSize={14}
                    fontColor={white}
                    text="SWITCH"
                    fontWeight={800}
                    callback={onSwitch}
                />
            )}

            {/* Delete Button - sixth column (if allowed) */}
            {canDelete && !isCurrent && (
                <RectButton
                    height={deleteButtonHeight}
                    width={deleteButtonWidth}
                    x={deleteCenterX}
                    y={rowCenterY}
                    color={red}
                    fontSize={14}
                    fontColor={white}
                    text={"DELETE"}
                    fontWeight={800}
                    callback={onDelete}
                />
            )}
        </>
    );
};

export default ClassObject;

