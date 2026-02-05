import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'; // Usamos onSnapshot

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
        
        // ESCUCHAMOS EN TIEMPO REAL: Si cambias el rol en BD, la app reacciona al instante
        const unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            
            // --- BLINDAJE DE SEGURIDAD ---
            setUserData({
              ...data,
              // Convertimos cualquier "basura" o undefined a false explícito
              isAdmin: !!data.isAdmin,
              isPasante: !!data.isPasante,
              isProfessional: !!data.isProfessional,
              isResponsable: !!data.isResponsable,
            });
          } else {
            // USUARIO NUEVO (Si entra por Google y no existe doc)
            const nuevoUsuario = {
              nombre: currentUser.displayName,
              email: currentUser.email,
              foto_url: currentUser.photoURL,
              rol: 'indefinido',
              estatus_cuenta: 'pendiente_registro',
              registro_completo: false,
              fecha_registro: serverTimestamp(),
              // Inicializamos banderas en false
              isAdmin: false,
              isPasante: false,
              isProfessional: false,
              isResponsable: false
            };
            // Usamos setDoc para crear
            setDoc(docRef, nuevoUsuario);
            setUserData(nuevoUsuario);
          }
          setLoading(false);
        });

        // Limpiamos el listener del documento al salir
        return () => unsubscribeDoc();

      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    userData,
    loading,
    faltaRegistro: userData && !userData.registro_completo,
    esperandoAprobacion: userData && userData.estatus_cuenta === 'pendiente_asignacion',
    esActivo: userData && userData.estatus_cuenta === 'activo',
  };

  return (
    <UserContext.Provider value={value}>
      {!loading && children}
    </UserContext.Provider>
  );
};