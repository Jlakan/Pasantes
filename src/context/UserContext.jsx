import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);

      if (currentUser) {
        setUser(currentUser);

        const docRef = doc(db, 'Usuarios', currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          // Ya existe, bajamos sus datos
          setUserData(docSnap.data());
        } else {
          // ES NUEVO: Creamos el cascarón básico
          const nuevoUsuario = {
            nombre: currentUser.displayName,
            email: currentUser.email,
            foto_url: currentUser.photoURL,

            // IMPORTANTE:
            rol: 'indefinido',
            estatus_cuenta: 'pendiente_registro', // Aún no llena el formulario
            registro_completo: false, // Bandera para saber si ya llenó datos

            fecha_registro: serverTimestamp(),
          };

          await setDoc(docRef, nuevoUsuario);
          setUserData(nuevoUsuario);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    userData,
    loading,
    // Helpers rápidos
    faltaRegistro: userData && !userData.registro_completo,
    esperandoAprobacion: userData && userData.estatus_cuenta === 'por_aprobar',
    esActivo: userData && userData.estatus_cuenta === 'activo',
  };

  return (
    <UserContext.Provider value={value}>
      {!loading && children}
    </UserContext.Provider>
  );
};
