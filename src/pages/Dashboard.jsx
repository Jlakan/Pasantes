import React, { useState } from 'react';
import { useUser } from '../context/UserContext';

// Importamos los componentes
import DashboardAdmin from './DashboardAdmin';
import DashboardStaff from './DashboardStaff';
import DashboardPasante from './DashboardPasante';

const Dashboard = () => {
  const { userData } = useUser();
  const [vistaAdmin, setVistaAdmin] = useState(true);

  // --- DEBUG TEMPORAL (Esto te dirá la verdad en la consola) ---
  console.log("--- DEBUG DASHBOARD ---");
  console.log("Usuario:", userData?.nombre);
  console.log("Rol Admin (DB):", userData?.isAdmin);
  console.log("Rol Pasante (DB):", userData?.isPasante);
  console.log("Objeto completo:", userData);
  // -----------------------------------------------------------

  if (!userData) return <div style={{padding:'20px'}}>Cargando perfil...</div>;

  // 1. CASO ADMIN (Con verificación estricta)
  if (userData.isAdmin === true) {
    // Verificamos si tiene doble rol para activar el botón de switch
    const tieneDobleRol = userData.isProfessional || userData.isResponsable;

    if (vistaAdmin) {
      return (
        <DashboardAdmin 
            esDobleRol={tieneDobleRol} 
            cambiarVista={() => setVistaAdmin(false)} 
        />
      );
    } else {
      return (
        <DashboardStaff 
            esAdminModoUsuario={true} 
            cambiarVista={() => setVistaAdmin(true)}
        />
      );
    }
  }

  // 2. CASO STAFF (Profesional o Jefe)
  if (userData.isProfessional || userData.isResponsable) {
    return <DashboardStaff />;
  }

  // 3. CASO PASANTE
  if (userData.isPasante) {
    return <DashboardPasante />;
  }

  // 4. FALLBACK
  return <div>Rol desconocido o no asignado. Contacta a soporte.</div>;
}; // <--- ESTA ES LA LLAVE QUE FALTABA

export default Dashboard;