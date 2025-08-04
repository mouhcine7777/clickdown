// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyADwZK9_eN0iqMPs0DQcZr9x-AANBqhfFw",
    authDomain: "projectmanager-576a9.firebaseapp.com",
    projectId: "projectmanager-576a9",
    storageBucket: "projectmanager-576a9.firebasestorage.app",
    messagingSenderId: "513461580176",
    appId: "1:513461580176:web:ce668616bd94527c3cc315",
    measurementId: "G-LZK13J4Q83"
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);