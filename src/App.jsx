import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RegistroData from './pages/RegistroData';
import { useUser } from './context/UserContext';
import { LogOut, Clock } from 'lucide-react';
import { logoutUser } from './services/auth';

// --- IMPORTAMOS EL SWITCHER ---
import RoleSwitcher from './components/RoleSwitcher';

// ... (Aquí va tu componente PantallaEspera, NO lo borres) ...
const PantallaEspera = () => (
  /* ... código existente ... */
  <div
    style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f8f9fa',
      padding: '2rem',
      textAlign: 'center',
    }}
  >
    <Clock
      size={64}
      color="var(--color-warning)"
      style={{ marginBottom: '1rem' }}
    />
    <h2 style={{ color: 'var(--color-primary)' }}>Solicitud en Revisión</h2>
    <p style={{ maxWidth: '400px', color: '#666' }}>
      Tus datos han sido enviados. El administrador debe aprobar tu rol.
    </p>
    <button
      onClick={logoutUser}
      style={{
        marginTop: '2rem',
        padding: '10px 20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        background: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <LogOut size={16} /> Cerrar Sesión
    </button>
  </div>
);

const RutasProtegidas = ({ children }) => {
  const { user, faltaRegistro, esperandoAprobacion } = useUser();
  if (!user) return <Navigate to="/login" />;
  if (faltaRegistro) return <RegistroData />;
  if (esperandoAprobacion) return <PantallaEspera />;
  return children;
};

function App() {
  const { user } = useUser();

  return (
    <Router>
      {/* AGREGAMOS EL BOTÓN FLOTANTE AQUÍ */}
      {/* Se mostrará siempre que haya usuario, para que puedas salir de cualquier pantalla */}
      {user && <RoleSwitcher />}

      <Routes>
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/" />}
        />
        <Route
          path="/"
          element={
            <RutasProtegidas>
              <Dashboard />
            </RutasProtegidas>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
