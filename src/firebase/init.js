// Firebase Init
import firebase from "firebase/compat/app";
import "firebase/compat/storage"; // Add compat storage

import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getStorage } from "firebase/storage";

// Firebase config
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
const app = firebase.initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize storage - try modular API, if it doesn't work, use compat
let storage;
try {
  storage = getStorage(app);
  console.log('Storage initialized with modular API');
} catch (error) {
  console.warn('Modular storage failed, trying compat:', error);
  // Fallback to compat storage if modular doesn't work
  storage = firebase.storage();
}

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

