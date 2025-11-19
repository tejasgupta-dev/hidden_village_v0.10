// Examples of using user settings functions
import { setUserSettings, getUserSettings } from './userSettings.js';

// EXAMPLE 1: SAVING SETTINGS TO DATABASE
// This is FIRST time saving settings or COMPLETE REPLACEMENT of all settings
// setUserSettings() ALWAYS overwrites ALL user settings
const saveSettings = async () => {
  const settings = {
    music: true,           // Music enabled
    sound: false,          // Sound effects disabled  
    levelRepetitions: 3,   // Repeat level 3 times
    language: "Russian",   // Interface language
    difficulty: "hard"     // Game difficulty
  };

  // Saves ALL settings to Firebase: Users/{userId}/settings
  await setUserSettings(settings);
};

// EXAMPLE 2: LOADING SETTINGS FROM DATABASE
// Gets ALL user settings from Firebase
// Returns object (not tuple!) with all settings or null if no settings exist
const loadSettings = async () => {
  const settings = await getUserSettings(); // Get object: { music: true, sound: false, ... }
  return settings; // Return settings object
};

// EXAMPLE 3: UPDATING EXISTING SETTINGS
// This is NOT duplication! This is a different approach:
// 1. First load CURRENT settings from database
// 2. Update only needed fields
// 3. Save UPDATED settings back to database
// 
// Why do this? To NOT LOSE other settings!
// If you just call setUserSettings({ music: false }), 
// you will LOSE all other settings (sound, levelRepetitions, etc.)
const updateSettings = async () => {
  // 1. Load CURRENT settings from database (or empty object if none exist)
  const currentSettings = await getUserSettings() || {};
  
  // 2. Create UPDATED settings: old + new changes
  const updatedSettings = {
    ...currentSettings,    // Copy ALL existing settings
    music: false,          // Change only music
    levelRepetitions: 5    // Change only number of repetitions
  };
  
  // 3. Save UPDATED settings (all old + new changes)
  await setUserSettings(updatedSettings);
};

// EXAMPLE 4: USING IN REACT COMPONENT
// Hook for convenient work with settings in React
const useSettings = () => {
  const [settings, setSettings] = useState(null); // Local settings state
  
  // On component load - load settings from database
  useEffect(() => {
    loadUserSettings();
  }, []);
  
  // Loads settings from database and saves to local state
  const loadUserSettings = async () => {
    const userSettings = await getUserSettings(); // Get from Firebase
    setSettings(userSettings); // Save to React local state
  };
  
  // Saves settings to database and updates local state
  const saveUserSettings = async (newSettings) => {
    const success = await setUserSettings(newSettings); // Save to Firebase
    if (success) {
      setSettings(newSettings); // Update React local state
    }
  };
  
  return { settings, saveUserSettings }; // Return settings and save function
};

export { saveSettings, loadSettings, updateSettings, useSettings };