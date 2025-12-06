// Firebase Init
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getStorage } from "firebase/storage";

// Firebase config
const firebaseConfig = {
  apiKey: process.env.apiKey || "AIzaSyCgFROG1iDZ2AiTp3H5eEtgQtkpajpbsUY",
  authDomain: process.env.authDomain || "uwm-11f9a.firebaseapp.com",
  databaseURL: process.env.databaseURL || "https://uwm-11f9a-default-rtdb.firebaseio.com",
  projectId: process.env.projectId || "uwm-11f9a",
  storageBucket: process.env.storageBucket || "uwm-11f9a.firebasestorage.app",
  messagingSenderId: process.env.messagingSenderId || "689113030161",
  appId: process.env.appId || "1:689113030161:web:acff8b2ca76d5ea7385bb0",
};

// Initialize Firebase with modular API
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

// Set session persistence
setPersistence(auth, browserSessionPersistence)
  .then(() => {
    // Existing and future Auth states are now persisted in the current
    // session only. Closing the window would clear any existing state even
    // if a user forgets to sign out.
    // TL;DR CLOSE WINDOW = SIGN IN AGAIN
  })
  .catch((error) => {
    // Handle errors
    console.error('Error setting session persistence:', error);
  });

export { app, auth, storage };

