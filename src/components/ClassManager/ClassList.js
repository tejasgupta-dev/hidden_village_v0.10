import React, { useState, useEffect } from 'react';
import { Text, Graphics } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { blue, white, black, green } from "../../utils/colors";
import RectButton from "../RectButton";
import ClassObject from "./ClassObject";
import { getUserEmailByUid } from "../../firebase/userDatabase";

const ClassList = (props) => {
    const { width, height, x, y, classes, currentClassId, currentUserRole, onSwitch, onDelete, firebaseApp } = props;

    const [startIndex, setStartIndex] = useState(0);
    const [classStats, setClassStats] = useState({});
    const [creatorEmails, setCreatorEmails] = useState({});
    
    // Calculate table dimensions
    const tableWidth = width;
    const tableHeight = height;
    const rowHeight = height * 0.08;
    const headerHeight = rowHeight;
    const headerY = y;
    const firstRowY = y + rowHeight;
    
    // Calculate how many classes fit in the table (excluding header row)
    const availableHeight = tableHeight - headerHeight;
    const classesPerPage = Math.max(1, Math.floor(availableHeight / rowHeight));

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

    // Load class statistics and creator emails
    useEffect(() => {
        const loadClassData = async () => {
            if (!classes || classes.length === 0 || !firebaseApp) return;
            
            const stats = {};
            const emails = {};
            
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
                    
                    // Get creator email
                    if (classItem.createdBy) {
                        const email = await getUserEmailByUid(classItem.createdBy, firebaseApp);
                        emails[classItem.id] = email;
                    }
                } catch (error) {
                    console.error(`Error loading data for class ${classItem.id}:`, error);
                    stats[classItem.id] = { studentCount: 0, gameCount: 0 };
                }
            }
            setClassStats(stats);
            setCreatorEmails(emails);
        };
        
        loadClassData();
    }, [classes, firebaseApp]);

    if (!classes || classes.length === 0) {
        return null;
    }

    const displayedClasses = classes.slice(startIndex, startIndex + classesPerPage);

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
                text={'CLASS NAME'}
                style={
                    new TextStyle({
                        align: 'left',
                        fontFamily: 'Arial',
                        fontSize: width * 0.016,
                        fontWeight: 'bold',
                        fill: [black],
                    })
                }
            />
            <Text
                x={x + tableWidth * 0.25}
                y={headerY + rowHeight * 0.3}
                text={'CREATED BY'}
                style={
                    new TextStyle({
                        align: 'left',
                        fontFamily: 'Arial',
                        fontSize: width * 0.016,
                        fontWeight: 'bold',
                        fill: [black],
                    })
                }
            />
            <Text
                x={x + tableWidth * 0.4}
                y={headerY + rowHeight * 0.3}
                text={'Students'}
                style={
                    new TextStyle({
                        align: 'center',
                        fontFamily: 'Arial',
                        fontSize: width * 0.016,
                        fontWeight: 'bold',
                        fill: [black],
                    })
                }
            />
            <Text
                x={x + tableWidth * 0.5}
                y={headerY + rowHeight * 0.3}
                text={'Games'}
                style={
                    new TextStyle({
                        align: 'center',
                        fontFamily: 'Arial',
                        fontSize: width * 0.016,
                        fontWeight: 'bold',
                        fill: [black],
                    })
                }
            />
            <Text
                x={x + tableWidth * 0.65}
                y={headerY + rowHeight * 0.3}
                text={'Switch'}
                style={
                    new TextStyle({
                        align: 'center',
                        fontFamily: 'Arial',
                        fontSize: width * 0.016,
                        fontWeight: 'bold',
                        fill: [black],
                    })
                }
            />
            <Text
                x={x + tableWidth * 0.8}
                y={headerY + rowHeight * 0.3}
                text={'Delete'}
                style={
                    new TextStyle({
                        align: 'right',
                        fontFamily: 'Arial',
                        fontSize: width * 0.016,
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
            
            {/* Display Classes */}
            {displayedClasses.map((classItem, index) => {
                const isCurrent = classItem.id === currentClassId;
                const stats = classStats[classItem.id] || { studentCount: 0, gameCount: 0 };
                const creatorEmail = creatorEmails[classItem.id] || classItem.createdBy || 'Unknown';
                
                return (
                    <ClassObject
                        key={classItem.id}
                        width={tableWidth}
                        height={rowHeight}
                        x={x}
                        y={firstRowY + (index * rowHeight)}
                        classData={classItem}
                        index={index}
                        isCurrent={isCurrent}
                        currentUserRole={currentUserRole}
                        studentCount={stats.studentCount}
                        gameCount={stats.gameCount}
                        creatorEmail={creatorEmail}
                        onSwitch={() => onSwitch(classItem.id)}
                        onDelete={() => onDelete(classItem)}
                    />
                );
            })}
            
            {/* Pagination Buttons - positioned at bottom right of table */}
            <RectButton
                height={height * 0.12}
                width={width * 0.1}
                x={x + tableWidth - 100}
                y={y + tableHeight - 40}
                color={green}
                fontSize={width * 0.016}
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
                color={green}
                fontSize={width * 0.016}
                fontColor={white}
                text={">"}
                fontWeight={800}
                callback={handleNextPage}
            />
        </>
    );
};

export default ClassList;

