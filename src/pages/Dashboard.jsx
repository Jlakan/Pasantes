import React, { useState } from 'react';
import { useUser } from '../context/UserContext';

// Importamos los componentes
import DashboardAdmin from './DashboardAdmin';
import DashboardStaff from './DashboardStaff';
import DashboardPasante from './DashboardPasante';
import RegistroData from './RegistroData'; // Importamos el registro por si acaso

const Dashboard = () => {
  const { userData, faltaRegistro } = useUser();
  const [vistaAdmin, setVistaAdmin] = useState(true);

  if (!userData) return <div style={{padding:'20px'}}>Cargando sistema...</div>;

  // 0. SI FALTA COMPLETAR REGISTRO
  if (faltaRegistro) {
    return <RegistroData />;
  }

  // 0.5 SI ESTÁ PENDIENTE DE APROBACIÓN (Opcional, mensaje de espera)
  if (userData.estatus_cuenta === 'pendiente_asignacion') {
    return (
      <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', flexDirection:'column'}}>
         <h2>⏳ Solicitud Enviada</h2>
         <p>Un administrador debe asignarte un rol y servicio.</p>
      </div>
    );
  }

  // 1. ROL DE ADMIN (Con Switch)
  if (userData.isAdmin) {
    // Detectamos si tiene doble vida (Admin + Responsable)
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

  // 2. ROL DE STAFF (Jefes y Profesionales)
  if (userData.isProfessional || userData.isResponsable) {
    return <DashboardStaff />;
  }

  // 3. ROL DE PASANTE
  if (userData.isPasante) {
    return <DashboardPasante />;
  }

  // 4. FALLBACK
  return <div>Tu cuenta está activa pero no tiene roles asignados. Contacta a soporte.</div>;
};

export default Dashboard;