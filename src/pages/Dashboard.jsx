import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';

// Importamos los componentes
import DashboardAdmin from './DashboardAdmin';
import DashboardStaff from './DashboardStaff';
import DashboardPasante from './DashboardPasante';

const Dashboard = () => {
  const { userData } = useUser();
  
  // Estado para controlar manualmente qué vista mostrar
  // Por defecto es 'admin' si es admin, sino lo que le toque.
  const [vistaAdmin, setVistaAdmin] = useState(true);

  if (!userData) return <div style={{padding:'20px'}}>Cargando perfil...</div>;

  // --- LÓGICA DEL SWITCH ---

  // CASO 1: Es ADMINISTRADOR (Y tal vez también Responsable)
  if (userData.isAdmin) {
    // Verificamos si TAMBIÉN es personal médico (doble rol)
    const tieneDobleRol = userData.isProfessional || userData.isResponsable;

    if (vistaAdmin) {
      return (
        <DashboardAdmin 
            // Pasamos estas props para que el DashboardAdmin pueda mostrar el botón
            esDobleRol={tieneDobleRol} 
            cambiarVista={() => setVistaAdmin(false)} 
        />
      );
    } else {
      // Si el admin desactivó su vista, le mostramos el Staff con un botón para volver
      return (
        <DashboardStaff 
            esAdminModoUsuario={true} // Flag para saber que es un admin "disfrazado"
            cambiarVista={() => setVistaAdmin(true)}
        />
      );
    }
  }

  // CASO 2: Es Staff normal (Jefe o Profesional)
  if (userData.isProfessional || userData.isResponsable) {
    return <DashboardStaff />;
  }

  // CASO 3: Es Pasante
  if (userData.isPasante) {
    return <DashboardPasante />;
  }

  return <div>Rol desconocido. Contacta a soporte.</div>;
};

export default Dashboard;