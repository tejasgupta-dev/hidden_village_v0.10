import { ref, push, getDatabase, set, query, equalTo, get, orderByChild, remove } from "firebase/database";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, setPersistence, browserSessionPersistence  } from "firebase/auth";
import { async } from "regenerator-runtime";
import { v4 as uuidv4 } from 'uuid';

// User Id functionality will be added in a different PR
let userId;

const UserPermissions = {
    Admin: 'Admin',
    Developer: 'Developer',
    Teacher: 'Teacher',
    Student: 'Student',
};

// Default Organization name constant
const DEFAULT_ORG_NAME = 'Default Organization';

// Helper function to check if organization is the Default Organization
export const isDefaultOrganization = async (orgId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const orgRef = ref(db, `orgs/${orgId}`);
        const snapshot = await get(orgRef);
        
        if (!snapshot.exists()) {
            return false;
        }
        
        const orgData = snapshot.val();
        return orgData.name === DEFAULT_ORG_NAME;
    } catch (error) {
        console.error('Error checking if default organization:', error);
        return false;
    }
};

// Helper function to get user email by UID
export const getUserEmailByUid = async (uid, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const userRef = ref(db, `users/${uid}`);
        const snapshot = await get(userRef);
        
        if (!snapshot.exists()) {
            return uid; // Return UID if user not found
        }
        
        const userData = snapshot.val();
        return userData.userEmail || uid; // Return email or UID as fallback
    } catch (error) {
        console.error('Error getting user email:', error);
        return uid; // Return UID on error
    }
};

// Function to refresh user context after organization/class changes
export const refreshUserContext = async (firebaseApp) => {
    try {
        // This function can be called after switching organizations/classes
        // to trigger a context refresh in components that use getCurrentUserContext
        console.log('refreshUserContext: User context refresh requested');
        
        // We can dispatch a custom event that components can listen to
        if (typeof window !== 'undefined') {
            console.log('refreshUserContext: Dispatching userContextChanged event');
            window.dispatchEvent(new CustomEvent('userContextChanged'));
            console.log('refreshUserContext: Event dispatched successfully');
        } else {
            console.warn('refreshUserContext: Window object not available, cannot dispatch event');
        }
        
        return true;
    } catch (error) {
        console.error('refreshUserContext: Error refreshing user context:', error);
        return false;
    }
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

// Create a new organization
export const createOrganization = async (name, ownerUid, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const orgId = uuidv4();
        const now = new Date().toISOString();
        
        const orgData = {
            name: name,
            ownerUid: ownerUid,
            createdAt: now,
            isArchived: false,
            members: {
                [ownerUid]: {
                    uid: ownerUid,
                    role: 'Admin',
                    status: 'active'
                }
            }
        };
        
        // Create organization
        await set(ref(db, `orgs/${orgId}`), orgData);
        
        // CREATE DEFAULT CLASS ONLY FOR DEFAULT ORGANIZATION
        const isDefaultOrg = name === DEFAULT_ORG_NAME;
        
        if (isDefaultOrg) {
            await createDefaultClass(orgId, firebaseApp);
            
            // Add owner to default class as teacher
            await set(ref(db, `orgs/${orgId}/classes/default/teachers/${ownerUid}`), {
                addedAt: now,
                addedBy: 'system'
            });
        }
        
        // Add organization to user's org list
        const userOrgData = {
            joinedAt: now,
            roleSnapshot: 'Admin',
            status: 'active',
            updatedAt: now
        };
        
        // Only set currentClassId if Default Organization
        if (isDefaultOrg) {
            userOrgData.currentClassId = 'default';
            userOrgData.classes = {
                default: {
                    joinedAt: now,
                    role: 'teacher'
                }
            };
        }
        
        await set(ref(db, `users/${ownerUid}/orgs/${orgId}`), userOrgData);
        
        console.log('Organization created with default class:', orgId);
        return orgId;
    } catch (error) {
        console.error('Error creating organization:', error);
        throw error;
    }
};

// Delete organization (Admin only)
export const deleteOrganization = async (orgId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const auth = getAuth(firebaseApp);
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
            throw new Error('No authenticated user');
        }
        
        // Check if this is Default Organization - cannot be deleted
        const isDefault = await isDefaultOrganization(orgId, firebaseApp);
        if (isDefault) {
            throw new Error('Cannot delete Default Organization. This organization is protected.');
        }
        
        // Get organization info
        const orgRef = ref(db, `orgs/${orgId}`);
        const orgSnapshot = await get(orgRef);
        
        if (!orgSnapshot.exists()) {
            throw new Error('Organization not found');
        }
        
        const orgData = orgSnapshot.val();
        
        // Check if user is Admin in this organization
        const userRole = orgData.members?.[currentUser.uid]?.role;
        if (userRole !== 'Admin') {
            throw new Error('Only Admins can delete organizations');
        }
        
        // Get all members to remove organization from their user records
        const members = orgData.members || {};
        const memberIds = Object.keys(members);
        
        // Remove organization from all users
        const userUpdates = memberIds.map(uid => 
            remove(ref(db, `users/${uid}/orgs/${orgId}`))
        );
        
        // Delete organization data (includes levels and games)
        await Promise.all([
            ...userUpdates,
            remove(ref(db, `orgs/${orgId}`))
        ]);
        
        console.log(`Organization ${orgId} deleted successfully`);
        return { success: true, memberCount: memberIds.length };
    } catch (error) {
        console.error('Error deleting organization:', error);
        throw error;
    }
};

// Get organization information by ID
export const getOrganizationInfo = async (orgId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const orgRef = ref(db, `orgs/${orgId}`);
        const orgSnapshot = await get(orgRef);
        
        if (orgSnapshot.exists()) {
            return { id: orgId, ...orgSnapshot.val() };
        }
        return null;
    } catch (error) {
        console.error('Error getting organization info:', error);
        return null;
    }
};

// Get current user's primary organization and role
export const getCurrentUserContext = async (firebaseApp) => {
    try {
        const auth = getAuth(firebaseApp);
        const user = auth.currentUser;
        
        if (!user) {
            console.warn('No authenticated user');
            return { orgId: null, role: null, orgName: 'Not Authenticated' };
        }
        
        // First check if user has a primary organization set
        const db = getDatabase(firebaseApp);
        const userRef = ref(db, `users/${user.uid}`);
        const userSnapshot = await get(userRef);
        
        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            console.log('User data:', userData);
            
            // If user has a primary organization set, use it
            if (userData.primaryOrgId) {
                console.log('Using primaryOrgId:', userData.primaryOrgId);
                const role = await getUserRoleInOrg(user.uid, userData.primaryOrgId, firebaseApp);
                // Get organization name
                const orgRef = ref(db, `orgs/${userData.primaryOrgId}/name`);
                const orgSnapshot = await get(orgRef);
                const orgName = orgSnapshot.exists() ? orgSnapshot.val() : 'Unknown Organization';
                return { orgId: userData.primaryOrgId, role, orgName };
            }
        }
        
        // Fallback: use the first organization from user's org list
        const userOrgs = await getUserOrgsFromDatabase(user.uid, firebaseApp);
        const orgIds = Object.keys(userOrgs);
        
        if (orgIds.length === 0) {
            console.warn('User is not in any organization');
            return { orgId: null, role: null, orgName: 'No Organization' };
        }
        
        // Use the first organization as primary
        const primaryOrgId = orgIds[0];
        const role = await getUserRoleInOrg(user.uid, primaryOrgId, firebaseApp);
        
        // Get organization name
        const orgRef = ref(db, `orgs/${primaryOrgId}/name`);
        const orgSnapshot = await get(orgRef);
        const orgName = orgSnapshot.exists() ? orgSnapshot.val() : 'Unknown Organization';
        
        return { orgId: primaryOrgId, role, orgName };
    } catch (error) {
        console.error('Error getting current user context:', error);
        return { orgId: null, role: null, orgName: 'Error' };
    }
};

// Backward compatibility function - returns role from primary organization
export const getUserRoleFromDatabase = async (firebaseApp) => {
    try {
        const { role } = await getCurrentUserContext(firebaseApp);
        return role;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
};

// Get current user's organization info for display
export const getCurrentUserOrgInfo = async (firebaseApp) => {
    try {
        const { orgId, role } = await getCurrentUserContext(firebaseApp);
        if (!orgId) {
            return { orgName: 'No Organization', role: null };
        }
        
        // Get organization name
        const db = getDatabase(firebaseApp);
        const orgRef = ref(db, `orgs/${orgId}/name`);
        const orgSnapshot = await get(orgRef);
        const orgName = orgSnapshot.exists() ? orgSnapshot.val() : 'Unknown Organization';
        
        return { orgName, role, orgId };
    } catch (error) {
        console.error('Error getting user org info:', error);
        return { orgName: 'Error', role: null };
    }
};

export const getUserNameFromDatabase = async (firebaseApp) => {
    try {
        const auth = getAuth(firebaseApp);
        const user = auth.currentUser;
        
        if (!user) {
            console.log("No authenticated user");
            return "USER NOT FOUND";
        }
        
        const db = getDatabase(firebaseApp);
        const userPath = `users/${user.uid}`;
        const userSnapshot = await get(ref(db, userPath));

        if (userSnapshot.exists()) {
            // User exists, return the user's name
            return userSnapshot.val().userName;
        } else {
            // User doesn't exist in the database
            console.log("User not found in database");
            return "USER NOT FOUND";
        }
    } catch (error) {
        console.error('Error getting user name:', error);
        return "USER NOT FOUND";
    }
};


// Get list of users by organization ID
export const getUsersByOrganizationFromDatabase = async (orgId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
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
export const getUserOrgsFromDatabase = async (uid, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const orgsRef = ref(db, `users/${uid}/orgs`);
        const snapshot = await get(orgsRef);
        return snapshot.exists() ? snapshot.val() : {};
    } catch (error) {
        console.error('Error getting user organizations:', error);
        return {};
    }
};

// Get user role in specific organization
export const getUserRoleInOrg = async (uid, orgId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
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
export const addUserToOrganization = async (uid, orgId, role, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const timestamp = new Date().toISOString();
        
        // Check if Default Class exists in this organization
        const defaultClassRef = ref(db, `orgs/${orgId}/classes/default`);
        const defaultClassSnapshot = await get(defaultClassRef);
        const hasDefaultClass = defaultClassSnapshot.exists();
        
        // Determine class role based on organization role
        const classRole = (role === 'Teacher' || role === 'Admin' || role === 'Developer') ? 'teacher' : 'student';
        const classRoleGroup = (role === 'Teacher' || role === 'Admin' || role === 'Developer') ? 'teachers' : 'students';
        
        const updates = [];
        
        // Prepare user org data
        const userOrgData = {
            roleSnapshot: role,
            status: 'active',
            joinedAt: timestamp,
            updatedAt: timestamp
        };
        
        // Only add to Default Class if it exists
        if (hasDefaultClass) {
            userOrgData.currentClassId = 'default';
            userOrgData.classes = {
                default: {
                    joinedAt: timestamp,
                    role: classRole
                }
            };
            
            // Add to default class in organization
            updates.push(
                set(ref(db, `orgs/${orgId}/classes/default/${classRoleGroup}/${uid}`), {
                    addedAt: timestamp,
                    addedBy: 'system'
                })
            );
        }
        
        updates.push(
            // Add to users/orgs
            set(ref(db, `users/${uid}/orgs/${orgId}`), userOrgData),
            // Add to orgs/members
            set(ref(db, `orgs/${orgId}/members/${uid}`), {
                uid,
                role,
                status: 'active'
            })
        );
        
        await Promise.all(updates);
        
        const classMsg = hasDefaultClass ? ' and added to Default Class' : '';
        console.log(`User ${uid} added to organization ${orgId} with role ${role}${classMsg}`);
        return true;
    } catch (error) {
        console.error("Error adding user to organization:", error);
        return false;
    }
};

// Remove user from organization
export const removeUserFromOrganization = async (uid, orgId, firebaseApp) => {
    try {
        // Check if this is Default Organization - users cannot be removed by admin
        const isDefault = await isDefaultOrganization(orgId, firebaseApp);
        if (isDefault) {
            throw new Error('Cannot remove users from Default Organization. Users can leave voluntarily.');
        }
        
        const db = getDatabase(firebaseApp);
        await Promise.all([
            remove(ref(db, `users/${uid}/orgs/${orgId}`)),
            remove(ref(db, `orgs/${orgId}/members/${uid}`))
        ]);
        
        console.log(`User ${uid} removed from organization ${orgId}`);
        return true;
    } catch (error) {
        console.error("Error removing user from organization:", error);
        throw error;
    }
};

// Leave organization (self-initiated by user)
export const leaveOrganization = async (userId, orgId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        
        // Check if user has other organizations
        const userOrgsRef = ref(db, `users/${userId}/orgs`);
        const userOrgsSnapshot = await get(userOrgsRef);
        
        if (!userOrgsSnapshot.exists()) {
            throw new Error('User has no organizations');
        }
        
        const userOrgs = userOrgsSnapshot.val();
        const orgIds = Object.keys(userOrgs);
        
        if (orgIds.length === 1 && orgIds[0] === orgId) {
            throw new Error('Cannot leave your only organization');
        }
        
        // Get user's primary org to check if switching is needed
        const userRef = ref(db, `users/${userId}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();
        const primaryOrgId = userData?.primaryOrgId;
        
        // Remove user from all classes in this organization
        const classesRef = ref(db, `users/${userId}/orgs/${orgId}/classes`);
        const classesSnapshot = await get(classesRef);
        
        if (classesSnapshot.exists()) {
            const classes = classesSnapshot.val();
            const classIds = Object.keys(classes);
            
            for (const classId of classIds) {
                // Remove from class students/teachers
                await Promise.all([
                    remove(ref(db, `orgs/${orgId}/classes/${classId}/students/${userId}`)),
                    remove(ref(db, `orgs/${orgId}/classes/${classId}/teachers/${userId}`))
                ]);
            }
        }
        
        // Remove user from organization
        await Promise.all([
            remove(ref(db, `users/${userId}/orgs/${orgId}`)),
            remove(ref(db, `orgs/${orgId}/members/${userId}`))
        ]);
        
        // If leaving current organization, switch to another one
        if (primaryOrgId === orgId) {
            const remainingOrgIds = orgIds.filter(id => id !== orgId);
            if (remainingOrgIds.length > 0) {
                await set(ref(db, `users/${userId}/primaryOrgId`), remainingOrgIds[0]);
                console.log(`Switched primary organization to: ${remainingOrgIds[0]}`);
            }
        }
        
        console.log(`User ${userId} left organization ${orgId}`);
        return true;
    } catch (error) {
        console.error('Error leaving organization:', error);
        throw error;
    }
};

// Update user role in organization
export const updateUserRoleInOrg = async (uid, orgId, newRole, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
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

// Find organization by name
export const findOrganizationByName = async (orgName, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const orgsRef = ref(db, 'orgs');
        const orgsSnapshot = await get(orgsRef);
        
        if (orgsSnapshot.exists()) {
            const orgs = orgsSnapshot.val();
            for (const [orgId, orgData] of Object.entries(orgs)) {
                if (orgData.name === orgName) {
                    return orgId;
                }
            }
        }
        return null;
    } catch (error) {
        console.error('Error finding organization by name:', error);
        return null;
    }
};

// Register new user and add to Admin Organization
export const registerNewUser = async (email, password, firebaseApp) => {
    try {
        // 1. Create user through Firebase Auth
        const auth = getAuth(firebaseApp);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const uid = user.uid;
        
        // 2. Get database instance with the app
        const db = getDatabase(firebaseApp);
        
        // 3. Find or create Default Organization
        const orgsRef = ref(db, 'orgs');
        const orgsSnapshot = await get(orgsRef);
        let defaultOrgId = null;
        
        if (orgsSnapshot.exists()) {
            const orgs = orgsSnapshot.val();
            // Find Default Organization by name
            for (const [orgId, orgData] of Object.entries(orgs)) {
                if (orgData.name === DEFAULT_ORG_NAME) {
                    defaultOrgId = orgId;
                    break;
                }
            }
        }
        
        // Create Default Organization if it doesn't exist
        if (!defaultOrgId) {
            console.log('Default Organization not found, creating it...');
            const newOrgId = uuidv4();
            const now = new Date().toISOString();
            const defaultOrgData = {
                name: DEFAULT_ORG_NAME,
                createdAt: now,
                createdBy: uid,
                isProtected: true,  // Mark as protected
                members: {
                    [uid]: {
                        uid: uid,
                        role: 'Admin',
                        status: 'active'
                    }
                }
            };
            
            await set(ref(db, `orgs/${newOrgId}`), defaultOrgData);
            
            // Create Default Class for Default Organization
            const defaultClassId = 'default';
            const defaultClassData = {
                name: 'Default Class',
                createdAt: now,
                createdBy: uid,
                isDefault: true
            };
            await set(ref(db, `orgs/${newOrgId}/classes/${defaultClassId}`), defaultClassData);
            
            defaultOrgId = newOrgId;
            console.log('Default Organization created:', defaultOrgId);
        }
        
        // 4. Extract username from email (part before @)
        const userName = email.split('@')[0];
        
        // 5. Create user record in database
        const now = new Date().toISOString();
        const userData = {
            userEmail: email,
            userName: userName,
            userId: uid,
            dateCreated: now,
            dateLastAccessed: now,
            primaryOrgId: defaultOrgId  // Set primary organization
        };
        
        await set(ref(db, `users/${uid}`), userData);
        
        // 6. Add user to Default Organization with Student role
        console.log('Adding user to Default Organization:', { uid, defaultOrgId, role: 'Student' });
        const addResult = await addUserToOrganization(uid, defaultOrgId, 'Student', firebaseApp);
        console.log('Add user result:', addResult);
        
        console.log('User registered successfully:', uid);
        return { success: true, uid: uid };
    } catch (error) {
        console.error('Error registering user:', error);
        throw error;
    }
};

// ============================================
// INVITE CODE FUNCTIONS
// ============================================

// Generate a unique invite code for an organization
export const generateInviteCode = async (orgId, role, creatorUid, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        
        // Generate unique code (UUID)
        let inviteCode;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;
        
        // Try to generate a unique code
        while (!isUnique && attempts < maxAttempts) {
            inviteCode = uuidv4();
            const inviteRef = ref(db, `invites/${inviteCode}`);
            const snapshot = await get(inviteRef);
            isUnique = !snapshot.exists();
            attempts++;
        }
        
        if (!isUnique) {
            throw new Error('Failed to generate unique invite code');
        }
        
        // Get organization name
        const orgRef = ref(db, `orgs/${orgId}`);
        const orgSnapshot = await get(orgRef);
        const orgName = orgSnapshot.exists() ? orgSnapshot.val().name : 'Unknown Organization';
        
        // Create invite data
        const inviteData = {
            code: inviteCode,
            orgId: orgId,
            orgName: orgName,
            role: role,
            createdBy: creatorUid,
            createdAt: new Date().toISOString(),
            status: 'active'
        };
        
        // Save invite to database
        await set(ref(db, `invites/${inviteCode}`), inviteData);
        
        console.log('Invite code generated:', inviteCode);
        return inviteCode;
    } catch (error) {
        console.error('Error generating invite code:', error);
        throw error;
    }
};

// Validate an invite code
export const validateInviteCode = async (code, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const inviteRef = ref(db, `invites/${code}`);
        const snapshot = await get(inviteRef);
        
        if (!snapshot.exists()) {
            return { valid: false, error: 'Invite code does not exist' };
        }
        
        const inviteData = snapshot.val();
        
        if (inviteData.status !== 'active') {
            return { valid: false, error: 'Invite code has already been used' };
        }
        
        return { 
            valid: true, 
            invite: inviteData 
        };
    } catch (error) {
        console.error('Error validating invite code:', error);
        return { valid: false, error: 'Error validating invite code' };
    }
};

// Use an invite code to join an organization
export const useInviteCode = async (code, userUid, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        
        // Validate the invite code
        const validation = await validateInviteCode(code, firebaseApp);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        const invite = validation.invite;
        
        // Add user to organization
        await addUserToOrganization(userUid, invite.orgId, invite.role, firebaseApp);
        
        // Delete the invite code (one-time use)
        await remove(ref(db, `invites/${code}`));
        
        console.log('Invite code used successfully:', code);
        return { 
            success: true, 
            orgId: invite.orgId, 
            orgName: invite.orgName, 
            role: invite.role 
        };
    } catch (error) {
        console.error('Error using invite code:', error);
        throw error;
    }
};

// Get all active invites for an organization
export const getInvitesForOrganization = async (orgId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const invitesRef = ref(db, 'invites');
        const snapshot = await get(invitesRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const allInvites = snapshot.val();
        const orgInvites = [];
        
        // Filter invites for this organization
        for (const [code, inviteData] of Object.entries(allInvites)) {
            if (inviteData.orgId === orgId && inviteData.status === 'active') {
                orgInvites.push(inviteData);
            }
        }
        
        return orgInvites;
    } catch (error) {
        console.error('Error getting invites for organization:', error);
        return [];
    }
};

// Delete an invite code
export const deleteInviteCode = async (code, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        await remove(ref(db, `invites/${code}`));
        console.log('Invite code deleted:', code);
        return { success: true };
    } catch (error) {
        console.error('Error deleting invite code:', error);
        throw error;
    }
};

// =====================================================
// CLASS MANAGEMENT FUNCTIONS
// =====================================================

// Create Default Class when organization is created
export const createDefaultClass = async (orgId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const classData = {
            name: "Default Class",
            createdBy: "system",
            createdAt: new Date().toISOString(),
            isDefault: true,
            teachers: {},
            students: {},
            assignedGames: {}
        };
        await set(ref(db, `orgs/${orgId}/classes/default`), classData);
        console.log('Default class created for organization:', orgId);
        return 'default';
    } catch (error) {
        console.error('Error creating default class:', error);
        throw error;
    }
};

// Create new class
export const createClass = async (orgId, className, creatorUid, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const classId = uuidv4();
        const now = new Date().toISOString();
        
        const classData = {
            name: className,
            createdBy: creatorUid,
            createdAt: now,
            isDefault: false,
            teachers: {
                [creatorUid]: {
                    addedAt: now,
                    addedBy: creatorUid
                }
            },
            students: {},
            assignedGames: {}
        };
        
        await set(ref(db, `orgs/${orgId}/classes/${classId}`), classData);
        
        // Add class to creator's user profile
        await set(ref(db, `users/${creatorUid}/orgs/${orgId}/classes/${classId}`), {
            joinedAt: now,
            role: 'teacher'
        });
        
        console.log('Class created:', classId, className);
        return classId;
    } catch (error) {
        console.error('Error creating class:', error);
        throw error;
    }
};

// Get all classes in organization
export const getClassesInOrg = async (orgId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const classesRef = ref(db, `orgs/${orgId}/classes`);
        const snapshot = await get(classesRef);
        
        if (!snapshot.exists()) return {};
        return snapshot.val();
    } catch (error) {
        console.error('Error getting classes in org:', error);
        return {};
    }
};

// Get user's classes in organization
export const getUserClassesInOrg = async (uid, orgId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const userClassesRef = ref(db, `users/${uid}/orgs/${orgId}/classes`);
        const snapshot = await get(userClassesRef);
        
        if (!snapshot.exists()) return {};
        return snapshot.val();
    } catch (error) {
        console.error('Error getting user classes:', error);
        return {};
    }
};

// Get class info
export const getClassInfo = async (orgId, classId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const classRef = ref(db, `orgs/${orgId}/classes/${classId}`);
        const snapshot = await get(classRef);
        
        if (!snapshot.exists()) return null;
        return snapshot.val();
    } catch (error) {
        console.error('Error getting class info:', error);
        return null;
    }
};

// Delete class
export const deleteClass = async (orgId, classId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const classInfo = await getClassInfo(orgId, classId, firebaseApp);
        
        if (!classInfo) throw new Error('Class not found');
        if (classInfo.isDefault) throw new Error('Cannot delete default class');
        
        // Remove class from all users
        const allMembers = {
            ...classInfo.teachers || {},
            ...classInfo.students || {}
        };
        
        const userUpdates = Object.keys(allMembers).map(uid =>
            remove(ref(db, `users/${uid}/orgs/${orgId}/classes/${classId}`))
        );
        
        // Delete class
        await Promise.all([
            ...userUpdates,
            remove(ref(db, `orgs/${orgId}/classes/${classId}`))
        ]);
        
        console.log('Class deleted:', classId);
        return true;
    } catch (error) {
        console.error('Error deleting class:', error);
        throw error;
    }
};

// Assign students to classes
export const assignStudentsToClasses = async (orgId, studentUids, classIds, assignerUid, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const updates = [];
        const now = new Date().toISOString();
        
        for (const studentUid of studentUids) {
            for (const classId of classIds) {
                // Add to class
                updates.push(
                    set(ref(db, `orgs/${orgId}/classes/${classId}/students/${studentUid}`), {
                        addedAt: now,
                        addedBy: assignerUid
                    })
                );
                
                // Add to user profile
                updates.push(
                    set(ref(db, `users/${studentUid}/orgs/${orgId}/classes/${classId}`), {
                        joinedAt: now,
                        role: 'student'
                    })
                );
            }
        }
        
        await Promise.all(updates);
        console.log('Students assigned to classes');
        return true;
    } catch (error) {
        console.error('Error assigning students to classes:', error);
        throw error;
    }
};

// Remove user from class
export const removeUserFromClass = async (orgId, classId, userId, firebaseApp) => {
    try {
        // Check if trying to remove from Default Class in Default Organization
        const isDefaultOrg = await isDefaultOrganization(orgId, firebaseApp);
        if (isDefaultOrg && classId === 'default') {
            throw new Error('Cannot remove users from Default Class in Default Organization.');
        }
        
        const db = getDatabase(firebaseApp);
        const updates = [];
        
        // Remove from class students
        updates.push(
            remove(ref(db, `orgs/${orgId}/classes/${classId}/students/${userId}`))
        );
        
        // Remove from class teachers
        updates.push(
            remove(ref(db, `orgs/${orgId}/classes/${classId}/teachers/${userId}`))
        );
        
        // Remove from user profile
        updates.push(
            remove(ref(db, `users/${userId}/orgs/${orgId}/classes/${classId}`))
        );
        
        await Promise.all(updates);
        console.log(`User ${userId} removed from class ${classId}`);
        return true;
    } catch (error) {
        // Не логируем ошибку, если это ожидаемое исключение (для Default Class)
        if (error.message && error.message.includes('Default Class')) {
            throw error; // Просто пробрасываем ошибку дальше для UI
        }
        console.error('Error removing user from class:', error);
        throw error;
    }
};

// Remove game from class
export const removeGameFromClass = async (orgId, classId, gameId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        
        // Remove from class assigned games
        await remove(ref(db, `orgs/${orgId}/classes/${classId}/assignedGames/${gameId}`));
        
        console.log(`Game ${gameId} removed from class ${classId}`);
        return true;
    } catch (error) {
        console.error('Error removing game from class:', error);
        throw error;
    }
};

// Assign games to classes
export const assignGamesToClasses = async (orgId, gameIds, classIds, assignerUid, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        const updates = [];
        const now = new Date().toISOString();
        
        for (const gameId of gameIds) {
            for (const classId of classIds) {
                updates.push(
                    set(ref(db, `orgs/${orgId}/classes/${classId}/assignedGames/${gameId}`), {
                        addedAt: now,
                        addedBy: assignerUid
                    })
                );
            }
        }
        
        await Promise.all(updates);
        console.log('Games assigned to classes');
        return true;
    } catch (error) {
        console.error('Error assigning games to classes:', error);
        throw error;
    }
};

// Switch user's current class
export const switchUserClass = async (uid, orgId, classId, firebaseApp) => {
    try {
        const db = getDatabase(firebaseApp);
        await set(ref(db, `users/${uid}/orgs/${orgId}/currentClassId`), classId);
        console.log('User switched to class:', classId);
        return true;
    } catch (error) {
        console.error('Error switching user class:', error);
        throw error;
    }
};

// Get current class context
export const getCurrentClassContext = async (firebaseApp) => {
    try {
        const auth = getAuth(firebaseApp);
        const user = auth.currentUser;
        
        if (!user) return { classId: null, className: null, orgId: null };
        
        const { orgId } = await getCurrentUserContext(firebaseApp);
        if (!orgId) return { classId: null, className: null, orgId: null };
        
        const db = getDatabase(firebaseApp);
        const currentClassRef = ref(db, `users/${user.uid}/orgs/${orgId}/currentClassId`);
        const snapshot = await get(currentClassRef);
        
        const classId = snapshot.exists() ? snapshot.val() : 'default';
        
        // Get class name
        const classInfo = await getClassInfo(orgId, classId, firebaseApp);
        const className = classInfo ? classInfo.name : 'Unknown Class';
        
        return { classId, className, orgId };
    } catch (error) {
        console.error('Error getting current class context:', error);
        return { classId: null, className: null, orgId: null };
    }
};

// Check and create Default Class if missing
export const ensureDefaultClass = async (orgId, firebaseApp) => {
    try {
        // Only create Default Class for Default Organization
        const isDefault = await isDefaultOrganization(orgId, firebaseApp);
        if (!isDefault) {
            console.log('Not Default Organization, skipping Default Class creation');
            return true;
        }
        
        const db = getDatabase(firebaseApp);
        const defaultClassRef = ref(db, `orgs/${orgId}/classes/default`);
        const snapshot = await get(defaultClassRef);
        
        if (!snapshot.exists()) {
            console.log('Default class not found, creating it...');
            await createDefaultClass(orgId, firebaseApp);
            console.log('Default class created successfully');
        } else {
            console.log('Default class already exists');
        }
        
        return true;
    } catch (error) {
        console.error('Error ensuring default class:', error);
        return false;
    }
};