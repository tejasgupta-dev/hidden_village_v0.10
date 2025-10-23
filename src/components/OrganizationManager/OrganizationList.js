import React, { useState } from 'react';
import { Text, Graphics } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import RectButton from '../RectButton';
import OrganizationObject from './OrganizationObject';
import { green, orange, black, white } from "../../utils/colors";

const OrganizationList = (props) => {
    const { width, height, x, y, organizations, onOrganizationSelect, currentOrgId, onOrganizationDelete, onOrganizationLeave, currentUserId } = props;

    const [startIndex, setStartIndex] = useState(0);

    const orgsPerPage = Math.floor(height / 9);

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
            <Graphics
                x={width * .3}
                y={height * 2.2}
                draw={(g) => {
                    // rectangle
                    g.beginFill(0xe0c755);
                    g.drawRect(width * 0.01, height * 0.01, width * 2, (orgsPerPage * 30));
                    g.endFill();
                    // border
                    g.lineStyle(4, 0x000000, 1);
                    g.drawRect(width * 0.01, height * 0.01, width * 2, (orgsPerPage * 30));
                }}
            />
            <Text
                x={width * .3}
                y={height * 1.5}
                text={'Organization'}
                style={
                    new TextStyle({
                        align: 'center',
                        fontFamily: 'Futura',
                        fontSize: 60,
                        fontWeight: 800,
                        fill: ['orange'],
                        letterSpacing: -5,
                    })
                }
            />
            <Text
                x={width * 1.5}
                y={height * 1.5}
                text={`Role`}
                style={
                    new TextStyle({
                        align: 'center',
                        fontFamily: 'Futura',
                        fontSize: 60,
                        fontWeight: 800,
                        fill: ['orange'],
                        letterSpacing: -5,
                    })
                }
            />
            {/* Display Organizations */}
            {displayedOrgs.map((org, index) => (
                <OrganizationObject
                    key={org.id || index}
                    width={width * .3}
                    height={height}
                    x={x}
                    y={y * 0.2 + (index + 1.2) * 25}
                    index={index}
                    organization={org}
                    isCurrent={org.id === currentOrgId}
                    onSelect={onOrganizationSelect}
                    onDelete={onOrganizationDelete}
                    onLeave={onOrganizationLeave}
                    currentUserId={currentUserId}
                />
            ))}
            {/* < Button */}
            <RectButton
                height={height * .7}
                width={width * .4}
                x={width * 1.9}
                y={height * 6}
                color={green}
                fontSize={width * .07}
                fontColor={white}
                text={"<"}
                fontWeight={800}
                callback={handlePrevPage}
            />
            {/* > Button */}
            <RectButton
                height={height * 0.7}
                width={width * .4}
                x={width * 2.1}
                y={height * 6}
                color={green}
                fontSize={width * .07}
                fontColor={white}
                text={">"}
                fontWeight={800}
                callback={handleNextPage}
            />
        </>
    );
};

export default OrganizationList;
