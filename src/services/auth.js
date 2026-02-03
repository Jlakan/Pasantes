// src/services/auth.js
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './firebase';

// Instancia del proveedor de Google
const provider = new GoogleAuthProvider();

// Función para Iniciar Sesión con Google
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Error en Google Auth:', error);
    return { success: false, error: 'Hubo un error al conectar con Google.' };
  }
};

// Función para Cerrar Sesión
export const logoutUser = async () => {
  await signOut(auth);
};
