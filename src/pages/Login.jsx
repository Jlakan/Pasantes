// src/pages/Login.jsx
import React, { useState } from 'react';
import { loginWithGoogle, logoutUser } from '../services/auth';
import { useUser } from '../context/UserContext'; // <--- Importamos el cerebro
import { ShieldAlert } from 'lucide-react';

const Login = () => {
  const { user, userData } = useUser(); // <--- Pedimos los datos del usuario
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const handleGoogleLogin = async () => {
    setCargando(true);
    setError(null);
    const resultado = await loginWithGoogle();
    if (!resultado.success) {
      setError(resultado.error);
    }
    setCargando(false);
  };

  // --- MODO DE PRUEBA ---
  // Si el usuario ya existe (Google lo detectó), mostramos sus datos de la DB
  if (user) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <img
            src={user.photoURL}
            alt="Perfil"
            style={{ width: '80px', borderRadius: '50%', marginBottom: '1rem' }}
          />
          <h3>¡Sesión Detectada!</h3>
          <p>
            Hola, <strong>{user.displayName}</strong>
          </p>

          <div
            style={{
              textAlign: 'left',
              background: '#f8f9fa',
              padding: '1rem',
              borderRadius: '8px',
              margin: '1rem 0',
            }}
          >
            <p>
              <strong>ID en DB:</strong>{' '}
              {userData ? '✅ Confirmado' : '⏳ Cargando...'}
            </p>
            <p>
              <strong>Rol:</strong> {userData?.rol || '...'}
            </p>
            <p>
              <strong>Estatus:</strong> {userData?.estatus_cuenta || '...'}
            </p>
          </div>

          <button
            onClick={logoutUser}
            style={{
              ...styles.googleButton,
              background: '#fee2e2',
              border: '1px solid #ef4444',
            }}
          >
            Cerrar Sesión (Reiniciar Prueba)
          </button>
        </div>
      </div>
    );
  }

  // --- MODO LOGIN (Si nadie ha entrado) ---
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={{ color: 'var(--color-primary)' }}>Nexus CEREDI</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Sistema de Control y Asistencia
          </p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          style={styles.googleButton}
          disabled={cargando}
        >
          {cargando ? (
            'Conectando...'
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Iniciar sesión con Google
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'var(--color-background)',
  },
  card: {
    backgroundColor: 'var(--color-surface)',
    padding: '3rem 2rem',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-md)',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  header: { marginBottom: '2.5rem' },
  googleButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#ffffff',
    color: '#3c4043',
    border: '1px solid #dadce0',
    borderRadius: '24px',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    color: 'var(--color-text-danger)',
    padding: '0.8rem',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontSize: '0.9rem',
    marginBottom: '1.5rem',
  },
};

export default Login;
