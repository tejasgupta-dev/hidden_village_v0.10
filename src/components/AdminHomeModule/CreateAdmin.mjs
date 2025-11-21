import { writeNewUserToDatabase } from "./CreateAdminForOrg.mjs";

const UserPermissions = {
    Admin: 'Admin',
    Developer: 'Developer',
    Teacher: 'Teacher',
    Student: 'Student',
};

const adminUserEmail = "admin@email.com"
const adminUserRole = UserPermissions.Admin
const adminUserOrganization = "Admin Organization"
const adminUserPassword = "admin1"

// Create admin user and organization
writeNewUserToDatabase(adminUserEmail, adminUserRole, adminUserPassword, adminUserOrganization)
    .then((result) => {
        if (result.success) {
            console.log("Admin user and organization created successfully!");
            console.log(`Organization ID: ${result.orgId}`);
            console.log(`User ID: ${result.userId}`);
        } else {
            console.error("Error creating admin:", result.error);
        }
    })
    .catch((error) => {
        console.error("Unexpected error:", error);
    });

// Terminal Commands
// node src/components/AdminHomeModule/CreateAdmin.mjs
// ctrl c <- once complete
