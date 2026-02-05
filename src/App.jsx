import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';

import Dashboard from './pages/Dashboard'; // O './pages/Dashboard', depende donde guardaste el Fragmento #4
// ------------------

import RegistroData from './pages/RegistroData';
import { useUser } from './context/UserContext';
import { LogOut, Clock } from 'lucide-react';
import { logoutUser } from './services/auth';

// Componente visual para la "Sala de Espera"
const PantallaEspera = () => (
    <div style={{height:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', background:'#f8f9fa', padding:'2rem', textAlign:'center'}}>
        <Clock size={64} color="var(--color-warning)" style={{marginBottom:'1rem'}}/>
        <h2 style={{color:'var(--color-primary)'}}>Solicitud en Revisión</h2>
        <p style={{maxWidth:'400px', color:'#666'}}>
            Tus datos han sido enviados. El administrador debe aprobar tu acceso antes de que puedas ingresar.
        </p>
        <button onClick={logoutUser} style={{marginTop:'2rem', padding:'10px 20px', border:'1px solid #ddd', borderRadius:'8px', background:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px'}}>
            <LogOut size={16}/> Cerrar Sesión
        </button>
    </div>
);

// Protector de Rutas: Decide qué pantalla mostrar según el estado del usuario
const RutasProtegidas = ({ children }) => {
  const { user, faltaRegistro, esperandoAprobacion } = useUser();
  
  // 1. No logueado -> Login
  if (!user) return <Navigate to="/login" />;

  // 2. Logueado sin datos -> Registro
  if (faltaRegistro) return <RegistroData />;

  // 3. Logueado pero no aprobado -> Espera
  if (esperandoAprobacion) return <PantallaEspera />;

  // 4. Todo correcto -> Dashboard (Admin, Pasante o Staff)
  return children;
};

function App() {
  const { user } = useUser();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={
          <RutasProtegidas>
            <Dashboard />
          </RutasProtegidas>
        } />
      </Routes>
    </Router>
  );
}

export default App;