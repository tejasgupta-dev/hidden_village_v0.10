import { ref, push, getDatabase, set, query, equalTo, get, orderByChild, remove } from "firebase/database";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, setPersistence, browserSessionPersistence  } from "firebase/auth";
import { async } from "regenerator-runtime";

const db = getDatabase();

// User Id functionality will be added in a different PR
let userId;

// Get the Firebase authentication instance
const auth = getAuth();

// Listen for changes to the authentication state
// and update the userId variable accordingly
onAuthStateChanged(auth, (user) => {
    userId = user.uid;
});

const UserPermissions = {
    Admin: 'Admin',
    Developer: 'Developer',
    Teacher: 'Teacher',
    Student: 'Student',
};

export const writeNewUserToDatabase = async (userEmail, userRole) => {
    // Create a new date object to get a timestamp
    const dateObj = new Date();
    const timestamp = dateObj.toISOString();

    console.log("Current User");

    // Get the Firebase authentication instance
    const auth = getAuth();

    // Log information about the current user, if one exists
    const currentUser = auth.currentUser;

    const newOrg = await getUserOrganizationFromDatabase();

    await createUserWithEmailAndPassword(auth, userEmail, "welcome")
    .then((userCredential) => {

        console.log("User created successfully:", userCredential.user);

        // Additional user information
        const user = userCredential.user;
        console.log("New User UID:", user.uid);
        console.log("New User email:", user.email);
        console.log("New User display name:", user.displayName);

        const newID = user.uid;
        const newEmail = user.email;
        const newRole = userRole;
        // lets addd user to the realtime database now
    
    
        writeCurrentUserToDatabaseNewUser(newID, newEmail, newRole, newOrg);
        alert("User Created")


    })
    .catch((error) => {
        console.error("Error creating auth user", error);
        // Handle errors (e.g., invalid email, weak password)
        console.error("Auth create failed:", error.code, error.message);   
        alert("Error Creating the User")
    });



};

export const writeCurrentUserToDatabaseNewUser = async (newID,newEmail,newRole, newOrg) => {
    // Create a new date object to get a timestamp
    const dateObj = new Date();
    const timestamp = dateObj.toISOString();

    userId = newID;
    console.log('User ID:', userId);

    const userEmail = newEmail;
    console.log(`User Email: ${userEmail}`)

    const userRole = newRole;
    console.log(`User Role: ${userRole}`)

    const userOrg = newOrg ?? ""
    console.log(`User Org: ${userOrg}`)

   // Extract username from email
    const userName = userEmail.split('@')[0];
    console.log(`User Name: ${userName}`);

    // db path
    // ref the realtime db
    const userPath = `Users/${userId}`;

    // Check if user already exists in the database
    const userSnapshot = await get(ref(db, userPath));

    if (userSnapshot.val() !== null) {
        // User already exists, do not add again
        // alert("User already exists in the database.");
        return false;
    }

    const promises = [
        set(ref(db, `${userPath}/userId`), userId),
        set(ref(db, `${userPath}/userName`), userName),
        set(ref(db, `${userPath}/userEmail`),userEmail ),
        set(ref(db, `${userPath}/userRole`),userRole),
        set(ref(db, `${userPath}/userOrg`),userOrg),
        set(ref(db, `${userPath}/dateCreated`),timestamp),
        set(ref(db, `${userPath}/dateLastAcccessed`),timestamp),

    ];
    return Promise.all(promises)
    .then(() => {
        // alert("User successfully published to database.");
        return true;
    })
    .catch(() => {
        alert("OOPSIE POOPSIE. Cannot publish user to database.");
        return false;
    });
};

// returns the user role
// // Example usage:
// // Assuming userId is available
// getUserRoleFromDatabase(userId)
// .then((userRole) => {
//     if (userRole !== null) {
//         console.log(`User Role: ${userRole}`);
//     } else {
//         console.log("User not found in the database.");
//     }
// })
// .catch((error) => {
//     console.error("Error retrieving user role:", error);
// });

// Get current user's primary organization and role
export const getCurrentUserContext = async () => {
    try {
        const userOrgs = await getUserOrgsFromDatabase(userId);
        const orgIds = Object.keys(userOrgs);
        
        if (orgIds.length === 0) {
            console.warn('User is not in any organization');
            return { orgId: null, role: null };
        }
        
        // Use the first organization as primary (or implement logic to choose primary org)
        const primaryOrgId = orgIds[0];
        const role = await getUserRoleInOrg(userId, primaryOrgId);
        
        return { orgId: primaryOrgId, role };
    } catch (error) {
        console.error('Error getting current user context:', error);
        return { orgId: null, role: null };
    }
};

// Backward compatibility function - returns role from primary organization
export const getUserRoleFromDatabase = async (props) => {
    try {
        const { role } = await getCurrentUserContext();
        return role;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
};

// Get current user's organization info for display
export const getCurrentUserOrgInfo = async () => {
    try {
        const { orgId, role } = await getCurrentUserContext();
        if (!orgId) {
            return { orgName: 'No Organization', role: null };
        }
        
        // Get organization name
        const orgRef = ref(db, `orgs/${orgId}/name`);
        const orgSnapshot = await get(orgRef);
        const orgName = orgSnapshot.exists() ? orgSnapshot.val() : 'Unknown Organization';
        
        return { orgName, role, orgId };
    } catch (error) {
        console.error('Error getting user org info:', error);
        return { orgName: 'Error', role: null };
    }
};

export const getUserNameFromDatabase = async (props) => {
    const userPath = `users/${userId}`;

    // Get the user snapshot from the database
    const userSnapshot = await get(ref(db, userPath));

    if (userSnapshot.exists()) {
        // User exists, return the user's name
        return userSnapshot.val().userName;
    } else {
        // User does not exist in the database
        // we should put the user in the database if they are not found
        try{
            console.log("User Not Found - Entering user into database")
            // Get the Firebase authentication instance
            const auth = getAuth();

            // Log information about the current user, if one exists
            const currentUser = auth.currentUser;

            // make this user a dev - they were probably created directly in firebase.
            // Note: This will need to be updated to work with organizations
            console.warn('Auto-creating user without organization. This should be updated.');
            await writeCurrentUserToDatabaseNewUser(currentUser.uid,currentUser.email,UserPermissions.Developer, null)

        }catch(error){
            console.log("User not found")
            return "USER NOT FOUND";
        }
        return "USER NOT FOUND";
    }
};


// Get list of users by organization ID
export const getUsersByOrganizationFromDatabase = async (orgId) => {
    try {
        const membersRef = ref(db, `orgs/${orgId}/members`);
        const membersSnapshot = await get(membersRef);

        if (membersSnapshot.exists()) {
            console.log('Users found for organization:', orgId);
            const usersList = [];

            // Loop through the members and get their full user data
            const members = membersSnapshot.val();
            for (const uid in members) {
                const userRef = ref(db, `users/${uid}`);
                const userSnapshot = await get(userRef);
                
                if (userSnapshot.exists()) {
                    const userData = userSnapshot.val();
                    // Add organization-specific data
                    userData.roleInOrg = members[uid].role;
                    userData.statusInOrg = members[uid].status;
                    usersList.push(userData);
                }
            }

            console.log('Userlist:', usersList);
            return usersList;
        } else {
            console.log('No users found for organization:', orgId);
            return [];
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
};

// Get user email for data download auto populate
export const getUserEmailFromDatabase = async (props) => {
    const userPath = `users/${userId}`;

    // Get the user snapshot from the database
    const userSnapshot = await get(ref(db, userPath));

    if (userSnapshot.exists()) {
        // User exists, return the user's email
        return userSnapshot.val().userEmail;
    } else {
        // User does not exist in the database
        return null;
    }
};

// Get all organizations for a user
export const getUserOrgsFromDatabase = async (uid) => {
    try {
        const orgsRef = ref(db, `users/${uid}/orgs`);
        const snapshot = await get(orgsRef);
        return snapshot.exists() ? snapshot.val() : {};
    } catch (error) {
        console.error('Error getting user organizations:', error);
        return {};
    }
};

// Get user role in specific organization
export const getUserRoleInOrg = async (uid, orgId) => {
    try {
        const orgRef = ref(db, `users/${uid}/orgs/${orgId}/roleSnapshot`);
        const snapshot = await get(orgRef);
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error('Error getting user role in organization:', error);
        return null;
    }
};

// Get user status in organization
export const getUserStatusInOrg = async (uid, orgId) => {
    try {
        const statusRef = ref(db, `users/${uid}/orgs/${orgId}/status`);
        const snapshot = await get(statusRef);
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error('Error getting user status in organization:', error);
        return null;
    }
};

// Add user to organization
export const addUserToOrganization = async (uid, orgId, role) => {
    try {
        const timestamp = new Date().toISOString();
        
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
        return false;
    }
};

// Remove user from organization
export const removeUserFromOrganization = async (uid, orgId) => {
    try {
        await Promise.all([
            remove(ref(db, `users/${uid}/orgs/${orgId}`)),
            remove(ref(db, `orgs/${orgId}/members/${uid}`))
        ]);
        
        console.log(`User ${uid} removed from organization ${orgId}`);
        return true;
    } catch (error) {
        console.error("Error removing user from organization:", error);
        return false;
    }
};

// Update user role in organization
export const updateUserRoleInOrg = async (uid, orgId, newRole) => {
    try {
        const timestamp = new Date().toISOString();
        
        await Promise.all([
            set(ref(db, `users/${uid}/orgs/${orgId}/roleSnapshot`), newRole),
            set(ref(db, `users/${uid}/orgs/${orgId}/updatedAt`), timestamp),
            set(ref(db, `orgs/${orgId}/members/${uid}/role`), newRole)
        ]);
        
        console.log(`User ${uid} role updated to ${newRole} in organization ${orgId}`);
        return true;
    } catch (error) {
        console.error("Error updating user role in organization:", error);
        return false;
    }
};