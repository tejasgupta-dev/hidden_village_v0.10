
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import firebase from "firebase/compat/app";
import { initializeApp } from 'firebase/app';
import { ref, push, getDatabase, set, query, equalTo, get, orderByChild } from "firebase/database";

import dotenv from 'dotenv';
dotenv.config();

// Import the uuid library
import { v4 as uuidv4 } from 'uuid';

// Now you can access your environment variables using process.env
const firebaseConfig = {
    apiKey: process.env.apiKey,
    authDomain: process.env.authDomain,
    databaseURL: process.env.databaseURL,
    projectId: process.env.projectId,
    storageBucket: process.env.storageBucket,
    messagingSenderId: process.env.messagingSenderId,
    appId: process.env.appId,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);



const UserPermissions = {
    Admin: 'Admin',
    Developer: 'Developer',
    Teacher: 'Teacher',
    Student: 'Student',
};

// Create organization
export const createOrganization = async (name, ownerUid) => {
    const orgId = uuidv4();
    const timestamp = new Date().toISOString();
    
    try {
        await set(ref(db, `orgs/${orgId}`), {
            name,
            ownerUid,
            createdAt: timestamp,
            isArchived: false
        });
        
        console.log(`Organization created: ${name} (${orgId})`);
        return orgId;
    } catch (error) {
        console.error("Error creating organization:", error);
        throw error;
    }
};

// Add user to organization
export const addUserToOrg = async (uid, orgId, role) => {
    const timestamp = new Date().toISOString();
    
    try {
        await Promise.all([
            set(ref(db, `users/${uid}/orgs/${orgId}`), {
                roleSnapshot: role,
                status: 'active',
                joinedAt: timestamp,
                updatedAt: timestamp
            }),
            set(ref(db, `orgs/${orgId}/members/${uid}`), {
                uid,
                role,
                status: 'active'
            })
        ]);
        
        console.log(`User ${uid} added to organization ${orgId} with role ${role}`);
        return true;
    } catch (error) {
        console.error("Error adding user to organization:", error);
        throw error;
    }
};


export const writeCurrentUserToDatabaseNewUser = async (newID, newEmail, newRole, orgId) => {
    // Create a new date object to get a timestamp
    const dateObj = new Date();
    const timestamp = dateObj.toISOString();

    const userId = newID;
    console.log('User ID:', userId);

    const userEmail = newEmail;
    console.log(`User Email: ${userEmail}`)

    const userRole = newRole;
    console.log(`User Role: ${userRole}`)

    console.log(`Organization ID: ${orgId}`)

    // Extract username from email
    const userName = userEmail.split('@')[0];
    console.log(`User Name: ${userName}`);

    // Check if user already exists in the database
    const userSnapshot = await get(ref(db, `users/${userId}`));

    if (userSnapshot.val() !== null) {
        // User already exists, do not add again
        console.log("User already exists in the database.");
        return false;
    }

    try {
        // Create basic user profile
        await set(ref(db, `users/${userId}`), {
            userId,
            userName,
            userEmail,
            dateCreated: timestamp,
            dateLastAccessed: timestamp
        });

        // Add user to organization
        await addUserToOrg(userId, orgId, userRole);

        console.log("User created and added to organization successfully");
        return true;
    } catch (error) {
        console.error("Error creating user:", error);
        return false;
    }
};

export const writeNewUserToDatabase = async (userEmail, userRole, userPassword, orgName) => {
    try {
        // Get the Firebase authentication instance
        const auth = getAuth();

        const userCredential = await createUserWithEmailAndPassword(auth, userEmail, userPassword);
        
        console.log("User created successfully:", userCredential.user);

        // Additional user information
        const user = userCredential.user;
        console.log("New User UID:", user.uid);
        console.log("New User email:", user.email);
        console.log("New User display name:", user.displayName);

        const newID = user.uid;
        const newEmail = user.email;
        const newRole = userRole;

        // Create organization first
        const orgId = await createOrganization(orgName, newID);
        
        // Add user to the database and organization
        await writeCurrentUserToDatabaseNewUser(newID, newEmail, newRole, orgId);
        
        console.log("User and organization created successfully");
        return { success: true, orgId, userId: newID };
        
    } catch (error) {
        console.error("Error creating user:", error);
        return { success: false, error: error.message };
    }
}

