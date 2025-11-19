import { app, auth } from "./init";
import { getDatabase, ref, set, get } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

let userId = null;
let authInitialized = false;

function ensureAuth() {
  if (authInitialized) return;
  onAuthStateChanged(auth, (user) => {
    userId = user ? user.uid : null;
  });
  authInitialized = true;
}

//helper that waits (briefly) for auth to provide a userId
function waitForAuthReady(timeoutMs = 3000) {
  if (userId) return Promise.resolve(userId);
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.uid) {
        userId = user.uid;
        unsubscribe();
        resolve(userId);
      }
    });
    // fallback: resolve after timeout (returns null)
    setTimeout(() => {
      try { unsubscribe(); } catch (e) {}
      resolve(userId);
    }, timeoutMs);
  });
}

/**
 * Saves user settings to Firebase (overwrites the settings node).
 * @param {Object} settings
 * @returns {Promise<boolean>}
 */
export const setUserSettings = async (settings) => {
  try {
    ensureAuth();
    // wait for auth to populate userId if needed
    await waitForAuthReady();
    if (!userId) return false;
    const db = getDatabase(app);
    const settingsRef = ref(db, `Users/${userId}/settings`);
    await set(settingsRef, settings);
    return true;
  } catch (error) {
    console.error("Error saving settings:", error);
    return false;
  }
};

/**
 * Loads user settings from Firebase (returns settings object or null)
 * @returns {Promise<Object|null>}
 */
export const getUserSettings = async () => {
  try {
    ensureAuth();
    // wait for auth to populate userId if needed
    await waitForAuthReady();
    if (!userId) return null;
    const db = getDatabase(app);
    const settingsRef = ref(db, `Users/${userId}/settings`);
    const snapshot = await get(settingsRef);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error("Error loading settings:", error);
    return null;
  }
};
