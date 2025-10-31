import { writeNewUserToDatabase } from "./CreateAdminForOrg.mjs";

const UserPermissions = {
    Admin: 'Admin',
    Developer: 'Developer',
    Teacher: 'Teacher',
    Student: 'Student',
};

const adminUserEmail = "admin@outlook.com"
const adminUserRole = UserPermissions.Admin
const adminUserOrganization = "admin org"
const adminUserPassword = "Admin2"

writeNewUserToDatabase(adminUserEmail,adminUserRole,adminUserPassword,adminUserOrganization);

// Terminal Commands
// node src/components/AdminHomeModule/CreateAdmin.mjs
// ctrl c <- once complete