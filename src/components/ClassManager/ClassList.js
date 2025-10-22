import React, { useState, useEffect } from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { blue, white, black } from "../../utils/colors";
import RectButton from "../RectButton";
import ClassObject from "./ClassObject";

const ClassList = (props) => {
    const { width, height, x, y, classes, currentClassId, currentUserRole, onSwitch, onDelete, firebaseApp } = props;

    const [startIndex, setStartIndex] = useState(0);
    const [classStats, setClassStats] = useState({});
    const classesPerPage = Math.floor(height / 80);

    const handleNextPage = () => {
        if (startIndex + classesPerPage < classes.length) {
            setStartIndex(startIndex + classesPerPage);
        }
    };

    const handlePrevPage = () => {
        if (startIndex > 0) {
            setStartIndex(Math.max(0, startIndex - classesPerPage));
        }
    };

    // Load class statistics
    useEffect(() => {
        const loadClassStats = async () => {
            if (!classes || classes.length === 0 || !firebaseApp) return;
            
            const stats = {};
            for (const classItem of classes) {
                try {
                    // Count students and teachers
                    const studentCount = classItem.students ? Object.keys(classItem.students).length : 0;
                    const teacherCount = classItem.teachers ? Object.keys(classItem.teachers).length : 0;
                    
                    // Count assigned games
                    const gameCount = classItem.assignedGames ? Object.keys(classItem.assignedGames).length : 0;
                    
                    stats[classItem.id] = {
                        studentCount: studentCount + teacherCount, // Include teachers in total
                        gameCount: gameCount
                    };
                } catch (error) {
                    console.error(`Error loading stats for class ${classItem.id}:`, error);
                    stats[classItem.id] = { studentCount: 0, gameCount: 0 };
                }
            }
            setClassStats(stats);
        };
        
        loadClassStats();
    }, [classes, firebaseApp]);

    if (!classes || classes.length === 0) {
        return null;
    }

    const displayedClasses = classes.slice(startIndex, startIndex + classesPerPage);

    return (
        <>
            {/* Headers */}
            <Text
                x={x}
                y={y * 0.8}
                text="Class Name"
                style={new TextStyle({
                    fontFamily: 'Arial',
                    fontSize: 20,
                    fontWeight: 'bold',
                    fill: [blue],
                })}
            />
            
            <Text
                x={x + width * 0.4}
                y={y * 0.8}
                text="Created By"
                style={new TextStyle({
                    fontFamily: 'Arial',
                    fontSize: 20,
                    fontWeight: 'bold',
                    fill: [blue],
                })}
            />

            {/* Class list */}
            {displayedClasses.map((classItem, index) => {
                const isCurrent = classItem.id === currentClassId;
                const stats = classStats[classItem.id] || { studentCount: 0, gameCount: 0 };
                
                return (
                    <ClassObject
                        key={classItem.id}
                        width={width * 0.15}
                        height={60}
                        x={x}
                        y={y + (index * 70)}
                        classData={classItem}
                        index={index}
                        isCurrent={isCurrent}
                        currentUserRole={currentUserRole}
                        studentCount={stats.studentCount}
                        gameCount={stats.gameCount}
                        onSwitch={() => onSwitch(classItem.id)}
                        onDelete={() => onDelete(classItem)}
                    />
                );
            })}

            {/* Pagination buttons */}
            {startIndex > 0 && (
                <RectButton
                    height={50}
                    width={50}
                    x={x - 60}
                    y={y + height * 0.4}
                    color={blue}
                    fontSize={20}
                    fontColor={white}
                    text="<"
                    fontWeight={800}
                    callback={handlePrevPage}
                />
            )}

            {startIndex + classesPerPage < classes.length && (
                <RectButton
                    height={50}
                    width={50}
                    x={x + width + 10}
                    y={y + height * 0.4}
                    color={blue}
                    fontSize={20}
                    fontColor={white}
                    text=">"
                    fontWeight={800}
                    callback={handleNextPage}
                />
            )}
        </>
    );
};

export default ClassList;

