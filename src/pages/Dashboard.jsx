import React from 'react';
import { useUser } from '../context/UserContext';
import { LogOut } from 'lucide-react';
import { logoutUser } from '../services/auth';

const Dashboard = () => {
  const { userData } = useUser();

  if (!userData) return <div style={{padding: '2rem'}}>Cargando datos del usuario...</div>;

  // --- PANTALLA DE LA VERDAD ---
  return (
    <div style={{
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100vh', 
      backgroundColor: 'black', 
      color: '#00ff00', // Verde brillante
      padding: '2rem', 
      fontFamily: 'monospace', 
      fontSize: '18px', 
      zIndex: 99999,
      overflowY: 'auto'
    }}>
      <h1>🔍 DIAGNÓSTICO DE VERDAD</h1>
      <hr style={{borderColor: 'white'}}/>
      
      <p><strong>Nombre:</strong> {userData.nombre}</p>
      <p><strong>UID:</strong> {userData.uid}</p>
      
      {/* Esto imprimirá true, false o undefined */}
      <p><strong>¿isAdmin? (Booleano):</strong> {JSON.stringify(userData.isAdmin)}</p>
      <p><strong>¿isPasante? (Booleano):</strong> {JSON.stringify(userData.isPasante)}</p>
      
      <div style={{marginTop: '20px', border: '1px solid white', padding: '10px'}}>
        <h3>👉 DIAGNÓSTICO:</h3>
        {userData.isAdmin === true 
          ? <span style={{color: 'red', fontWeight: 'bold'}}>EL SISTEMA DICE QUE ERES ADMIN. (Ve a Firebase y cámbialo a false)</span>
          : <span style={{color: 'cyan'}}>EL SISTEMA NO TE VE COMO ADMIN. (Si veías el panel, tenías código mezclado)</span>
        }
      </div>

      <button 
        onClick={logoutUser} 
        style={{
          marginTop: '30px', 
          padding: '15px', 
          backgroundColor: 'white', 
          color: 'black', 
          fontWeight: 'bold', 
          cursor: 'pointer',
          borderRadius: '8px',
          border: 'none'
        }}
      >
        <LogOut size={16} style={{verticalAlign: 'middle', marginRight:'5px'}}/> 
        CERRAR SESIÓN Y REINICIAR
      </button>
    </div>
  );
};

export default Dashboard;