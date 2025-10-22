import React, { useEffect, useState } from "react";
import Loader from "./utilities/Loader.js";
import Home from "./Home.js";
import OrganizationSelector from "./OrganizationSelector.js";
import { useMachine } from "@xstate/react";
import { StoryMachine } from "../machines/storyMachine.js";
import { Stage } from "@inlet/react-pixi";
import { yellow } from "../utils/colors";
import { generateRowAndColumnFunctions } from "./utilities/layoutFunction";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import PlayMenu from "./PlayMenu/PlayMenu.js";
import { getCurrentUserContext, getUserNameFromDatabase, getCurrentUserOrgInfo } from "../firebase/userDatabase";

// Layout constants
const [
  numRows,
  numColumns,
  marginBetweenRows,
  marginBetweenColumns,
  columnGutter,
  rowGutter,
] = [2, 3, 20, 20, 30, 30];

const Story = () => {
  const [height, setHeight] = useState(window.innerHeight);
  const [width, setWidth] = useState(window.innerWidth);
  const [state, send] = useMachine(StoryMachine);
  const [userName, setUserName] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userOrg, setUserOrg] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Get Firebase app instance
  const firebaseApp = firebase.app();

  let [rowDimensions, columnDimensions] = generateRowAndColumnFunctions(
    width,
    height,
    numRows,
    numColumns,
    marginBetweenRows,
    marginBetweenColumns,
    columnGutter,
    rowGutter
  );

  // Check auth state
  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = "/signin";
      } else {
        setIsAuthenticated(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch user name and role after auth
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchUserData = async () => {
      try {
        const [name, userContext, orgInfo] = await Promise.all([
          getUserNameFromDatabase(firebaseApp),
          getCurrentUserContext(firebaseApp),
          getCurrentUserOrgInfo(firebaseApp),
        ]);

        if (name && name !== "USER NOT FOUND") {
          setUserName(name);
        } else {
          console.warn("User name not found.");
        }

        console.log('User context:', userContext);
        console.log('User role from context:', userContext.role);
        setUserRole(userContext.role);
        setUserOrg(orgInfo.orgName);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [isAuthenticated]);

  // Handle window resize to update dimensions
  useEffect(() => {
    const handleResize = () => {
      setHeight(window.innerHeight);
      setWidth(window.innerWidth);
      [rowDimensions, columnDimensions] = generateRowAndColumnFunctions(
        width,
        height,
        numRows,
        numColumns,
        marginBetweenRows,
        marginBetweenColumns,
        columnGutter,
        rowGutter
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Gate for moving to "ready" state
  useEffect(() => {
    if (
      isAuthenticated &&
      userName &&
      userName !== "USER NOT FOUND" &&
      userRole &&
      userOrg &&
      state.value === "loading"
    ) {
      send("TOGGLE"); // Go to "ready"
    }
  }, [isAuthenticated, userName, userRole, userOrg, state, send]);

  const loading =
    !isAuthenticated || !userName || userName === "USER NOT FOUND";
  
  const needsOrganizationSelection = 
    isAuthenticated && userName && userName !== "USER NOT FOUND" && (!userRole || !userOrg);

  return (
    <>
      {loading ? (
        <Loader />
      ) : needsOrganizationSelection ? (
        <Stage
          height={height}
          width={width}
          options={{
            antialias: true,
            autoDensity: true,
            backgroundColor: yellow,
          }}
        >
          <OrganizationSelector
            width={width}
            height={height}
            onOrganizationSelected={() => {
              // This will trigger a page reload, so no need to handle state
            }}
          />
        </Stage>
      ) : (
        <Stage
          height={height}
          width={width}
          options={{
            antialias: true,
            autoDensity: true,
            backgroundColor: yellow,
          }}
        >
          {state.value === "ready" && (
            <Home
              width={width}
              height={height}
              startCallback={() => send("TOGGLE")}
              logoutCallback={() => firebase.auth().signOut()}
              userName={userName}
            />
          )}

          {state.value === "main" && (
            <PlayMenu
              width={width}
              height={height}
              columnDimensions={columnDimensions}
              rowDimensions={rowDimensions}
              userName={userName}
              role={userRole}
              organization={userOrg}
              logoutCallback={() => firebase.auth().signOut()}
            />
          )}
        </Stage>
      )}
    </>
  );
};

export default Story;
