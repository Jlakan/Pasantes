import React from 'react';
import { useUser } from '../context/UserContext';
import { LogOut } from 'lucide-react';
import { logoutUser } from '../services/auth';

const Dashboard = () => {
  const { userData } = useUser();

  if (!userData) return <div>Cargando datos del usuario...</div>;

  // --- BLOQUE DE DIAGNÓSTICO VISUAL ---
  return (
    <div style={{
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100vh', 
      backgroundColor: 'black', 
      color: '#00ff00', // Verde Matrix para que resalte
      padding: '2rem', 
      fontFamily: 'monospace', 
      fontSize: '18px', 
      zIndex: 99999,
      overflowY: 'auto'
    }}>
      <h1>🔍 DIAGNÓSTICO DE VERDAD</h1>
      <hr style={{borderColor: 'white'}}/>
      
      <p><strong>1. Nombre:</strong> {userData.nombre}</p>
      <p><strong>2. UID:</strong> {userData.uid}</p>
      
      {/* Usamos JSON.stringify para ver el valor REAL (true, false o undefined) */}
      <p><strong>3. ¿isAdmin? (Booleano):</strong> {JSON.stringify(userData.isAdmin)}</p>
      <p><strong>4. ¿isPasante? (Booleano):</strong> {JSON.stringify(userData.isPasante)}</p>
      <p><strong>5. Rol (Texto):</strong> "{userData.rol}"</p>
      
      <div style={{marginTop: '20px', border: '1px solid white', padding: '10px'}}>
        <h3>👉 RESULTADO:</h3>
        {userData.isAdmin === true 
          ? <span style={{color: 'red', fontWeight: 'bold'}}>EL SISTEMA TE VE COMO ADMIN. (Error en Base de Datos)</span>
          : <span style={{color: 'cyan'}}>EL SISTEMA NO TE VE COMO ADMIN. (Error en Código)</span>
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
          cursor: 'pointer'
        }}
      >
        <LogOut size={16} style={{verticalAlign: 'middle'}}/> CERRAR SESIÓN
      </button>
    </div>
  );
};

export default Dashboard;