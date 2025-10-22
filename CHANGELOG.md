# Hidden Village Project Changelog - Version 0.5
Classes: [ADDED, FIXED, CHANGED, UPDATED, REMOVED]

## Final Update 4/20/2024 - v0.5.8 (Final Update)
## All Changes And Additions

### Home Screen
- Created a Playing As UI Element
- Created a log out button at the start
- Redirects to the new Main Menu

### Main Menu
- Added Buttons to route to:
  - Play Game
  - Settings (not implemented)

### Admin Module
- **New, Edit Game**
- **New, Edit Level**
- Created a screen to see all users in players' organizations
- Allows admins to edit users' roles
- Has a button to redirect to New User Module

### New User Module
- Ability to add a new user to the organization
- Has a script to add an admin to a new organization
- `CreateAdmin.mjs`

### New Level
- Updated from the old Conjecture Editor
- Added a button to direct to a Test Pose
- Tests the selected pose to ensure it works
- New Level saves to the database with new values
- Cancel, deletes cached values
- Publish saves to the database and deletes cached values

### Edit Level
- Added this new Module
- Can select Levels that are drafted or published into saved database, to edit with Pin
- Can search using a search bar
- Can see what levels are published
- Can see all levels in the database, using next and previous buttons
- Clicking a level redirects to the Level Editor (New Level) Module

### New Game
- New Module to allow users to add levels to a game.
- Set Game Options, Story Editor are placeholders
- Instructions provide a brief description
- Add Game Name, Author, and Keywords to a new game
- Save or Publish
- Add Conjecture, takes you to a Level Select Screen

### Level Select Screen
- Allows users to search for needed levels
- Select by clicking the green plus
- Cycle through all levels with previous and next
- Click level to preview
- Ok - placeholder
- Back goes to the Game Editor
- When a level is added you can:
  - Preview the level
  - Move level position
  - Remove Level

### Edit Game Module
- Brings up all of the Game modules
- Click one of the games to edit
- Needs to Pin to edit

### Play Game Button
- Brings up the Game Select Screen
- Once a Game is selected, goes into the play game sequence
- Play Game Sequence will play all the Levels in the Game
- Presents a back button when complete

-----------------------------------------------------------------------------------------------------------------------------


## Update: 2/24/2024 - v0.5.7.1 (Week #7)
### Database Comparison
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/11): Pose matching module that takes in a conjecture UUID and uses the database function to initiate pose matching

- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/11): Added in handling for tolerance if a pose tolerance value is specified in the database

- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/11): Added a pose test button that shows matching and allows for future development as this feature will be used in the background

- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/11): Added in background for pose matching

### User Management Feature
#### User Information Database
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/12): User information into the database. User is now stored in a sperate location from the database. User information is, date created, last accessed, email, username, organization, and role.

- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/12): Functions to retrieve user data. User role, username, user organization. Functions to also store data.

- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/12): a UI improvement to show what user is currently logged in.

#### User Managment Module
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/12): The ability to create a new authenticated user directly from the program.

- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/12): A User Management Module. This is where you can change user's roles. Add a new user. See all users in current user's organization.

## Update: 2/9/2024 -v0.5.2.2
### Test Conjecture Module
#### Helper Functions 
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/9): Get Conjecture Key by Conjecture Data. Give the data, and it will find the key value for the conjecture. This is needed because there is a dynamic name being exported with "Conjecture: " into the database.
#### Functions
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/9): TestConjectureModule(), this function is called when the module is opened. It renders the screen, and returns data based on the selected Conjecture. Module's conjecture is currently hardcoded by UUID. TODO - change it so you can send a UUID, to select a pose.
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/9): handleNewPoseButtonClick() handles when the user presses the button. Cycles through the start, intermediate, end poses of the conjecture data.
#### Buttons
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/9): added back button, test pose data retreival and next pose button handler. (To be removed in a later patch)
#### Home Screen Update For Module
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/9): a button to go to the test module.
### Conjecture Database Objects
#### Database Values
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/6): a UUID to conjectures.
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/7): a AuthorID to conjectures.
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/7): the PIN to conjectures.
#### Database Functions
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/7): getConjectureDataByUUID(conjectureID) returns conjecture based on UUID.
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/7): getConjectureDataByAuthorID(AuthorID) returns conjecture based on the user authentication ID (NOTE: It is not the ID that the user writes into the conjecture. That information is not saved for some reason).
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/7): getConjectureDataByPIN(PIN) returns conjecture based on PIN (should return one, but since the user creates it, it can return multiple) 

### Interface Enhancements
- [CHANGED](https://github.com/T0rt13/hidden_village_v0.5/pull/6): the time to capture pose from 10 seconds to 2 seconds. For ease of use. Might change back later
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/7): test UUID, AUTHORID, PIN button to the conjecture editor, will be removed in a later update.

## Update: 2/5/2024 -v0.5.2.1
### Interface Enhancements
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/5): a logout button from the homescreen to allow the user to sign into a different account.
- [FIXED](https://github.com/T0rt13/hidden_village_v0.5/pull/5): the autocomplete error for email in the Sign on Screen.
- [ADDED](https://github.com/T0rt13/hidden_village_v0.5/pull/5): mouse cursor will now change to a pointer when hovering a button/reactbutton.
  
## Update: 2/2/2024 - v0.5.1.1
### Authentication Changes
- CHANGED: Authentication data is no longer persistent. Players now need to log in every time the browser is reopened.

### Interface Enhancements
- UPDATED: various button visuals for improved aesthetics.
- ADDED: a back button to the conjecture editor, facilitating easy navigation back to the home screen.















