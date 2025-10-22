import React, { useState, useEffect } from 'react';
import { Text } from "@inlet/react-pixi";
import { TextStyle } from "@pixi/text";
import { blue, white, red, green, black, navyBlue } from "../../utils/colors";
import RectButton from "../RectButton";
import Background from "../Background";
import OrganizationList from "./OrganizationList";
import { getCurrentUserContext, getUserOrgsFromDatabase, getOrganizationInfo } from "../../firebase/userDatabase";
import { getAuth } from "firebase/auth";

const OrganizationManager = ({ width, height, firebaseApp, mainCallback }) => {
  const [organizations, setOrganizations] = useState([]);
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [currentOrgName, setCurrentOrgName] = useState('Loading...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      
      // Get current user context
      const { orgId } = await getCurrentUserContext(firebaseApp);
      setCurrentOrgId(orgId);
      
      // Get user's organizations
      const auth = getAuth(firebaseApp);
      const user = auth.currentUser;
      if (!user) return;

      const userOrgs = await getUserOrgsFromDatabase(user.uid, firebaseApp);
      const orgList = [];
      
      // Get full organization data for each org
      for (const [orgId, orgData] of Object.entries(userOrgs)) {
        const orgInfo = await getOrganizationInfo(orgId, firebaseApp);
        if (orgInfo) {
          orgList.push({
            id: orgId,
            name: orgInfo.name || 'Unknown Organization',
            roleSnapshot: orgData.roleSnapshot || 'Member',
            status: orgData.status || 'active'
          });
        }
      }
      
      setOrganizations(orgList);
      
      // Set current organization name
      const currentOrg = orgList.find(org => org.id === orgId);
      setCurrentOrgName(currentOrg ? currentOrg.name : 'None');
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading organizations:', error);
      setCurrentOrgName('Error loading organizations');
      setLoading(false);
    }
  };

  const handleOrganizationSelect = (organization) => {
    console.log('Organization selected:', organization);
    // TODO: Implement organization switching
  };

  return (
    <>
      <Background height={height * 1.1} width={width} />
      
      {/* Title */}
      <Text
        text="Organization Manager"
        x={width * 0.12}
        y={height * 0.01}
        style={new TextStyle({
          align: "center",
          fontFamily: "Futura",
          fontSize: 80,
          fontWeight: 800,
          fill: [blue],
          letterSpacing: -5,
        })}
      />
      
      {/* Organizations List */}
      {organizations.length > 0 && (
        <OrganizationList 
          organizations={organizations} 
          height={height * 0.12}
          width={width * 0.26}
          x={width * 0.4}
          y={height * 1}
          currentOrgId={currentOrgId}
          onOrganizationSelect={handleOrganizationSelect}
        />
      )}
      
      {/* Current Organization */}
      <Text
        text={`Current Organization: ${currentOrgName}`}
        x={width * 0.1}
        y={height * 0.2}
        style={new TextStyle({
          align: "left",
          fontFamily: "Arial",
          fontSize: 24,
          fontWeight: "bold",
          fill: [green],
        })}
      />
      
      {/* Refresh Button */}
      <RectButton
        height={height * 0.13}
        width={width * 0.4}
        x={width * 0.4}
        y={height * 0.85}
        color={navyBlue} 
        fontSize={width * 0.015}
        fontColor={white} 
        text={loading ? "REFRESHING..." : "REFRESH ORGANIZATIONS"}
        fontWeight={800}
        callback={loadOrganizations}
      />
      
      {/* Back Button */}
      <RectButton
        height={height * 0.13}
        width={width * 0.26}
        x={width * 0.15}
        y={height * 0.85}
        color={red}
        fontSize={width * 0.015}
        fontColor={white}
        text="BACK"
        fontWeight={800}
        callback={mainCallback}
      />
    </>
  );
};

export default OrganizationManager;