// src/services/firebase.js
import { initializeApp } from 'firebase/app';
// --- ESTAS DOS LÍNEAS SON LAS QUE TE FALTAN ARRIBA: ---
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyBTaWhVXztE3hl-PXj97tY57TsyvQL5jeA',
  authDomain: 'pasantes-ceredi.firebaseapp.com',
  projectId: 'pasantes-ceredi',
  storageBucket: 'pasantes-ceredi.firebasestorage.app',
  messagingSenderId: '391487156420',
  appId: '1:391487156420:web:74db27bf6fe2a2a85d9991',
  measurementId: 'G-804CWEZ61S',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// --- ESTO ES LO QUE TE FALTA ---
// Tienes que exportar 'auth' y 'db' para que los otros archivos puedan usarlos.
export const auth = getAuth(app);
export const db = getFirestore(app);
