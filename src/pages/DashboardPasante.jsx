// src/pages/DashboardPasante.jsx
import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'; // addDoc permite añadir a subcolecciones
import { LogOut, CheckCircle } from 'lucide-react';
import { logoutUser } from '../services/auth';

const RESPONSABLES = [
  'Psic. Ana Martínez',
  'Dr. Carlos López',
  'Lic. Sofía Ramírez',
  'T.F. Jorge Hernández',
];

const DashboardPasante = () => {
  const { user } = useUser();
  const [responsable, setResponsable] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!responsable) return alert('Por favor selecciona un responsable');

    setLoading(true);
    try {
      // --- LÓGICA DE CARPETAS (ORDEN) ---
      const hoy = new Date();
      const year = hoy.getFullYear().toString(); // "2026"
      // Truco: "0" + (mes+1) asegura que Enero sea "01" y no "1" (mejor orden visual)
      const mesNombre = hoy.toLocaleString('es-ES', { month: 'long' });
      const mesNumero = (hoy.getMonth() + 1).toString().padStart(2, '0');
      const nombreCarpetaMes = `${mesNumero}_${
        mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)
      }`; // "01_Enero"

      // RUTA: Asistencias -> 2026 -> 01_Enero -> [Documento]
      // Nota cómo encadenamos la ruta:
      const coleccionDestino = collection(
        db,
        'Asistencias',
        year,
        nombreCarpetaMes
      );

      await addDoc(coleccionDestino, {
        uid_pasante: user.uid,
        nombre_pasante: user.displayName,
        foto_pasante: user.photoURL,
        responsable_seleccionado: responsable,
        fecha: serverTimestamp(),
        tipo: 'entrada',
        estatus: 'pendiente_validacion',
        // Guardamos también las rutas "planas" por si quieres buscar sin navegar carpetas luego
        meta_year: year,
        meta_mes: nombreCarpetaMes,
      });

      setMensaje('¡Solicitud enviada y archivada correctamente!');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al registrar entrada');
    }
    setLoading(false);
  };

  // ... (El resto del return visual es IDÉNTICO al anterior, no cambia nada visualmente)
  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <span style={{ fontWeight: 'bold' }}>Nexus Pasantes</span>
        <button onClick={logoutUser} style={styles.logoutBtn}>
          <LogOut size={18} />
        </button>
      </nav>

      <main style={styles.main}>
        <div style={styles.headerCard}>
          <img src={user.photoURL} alt="Perfil" style={styles.avatar} />
          <div>
            <h2>Hola, {user.displayName?.split(' ')[0]}</h2>
            <p style={{ color: 'var(--color-text-muted)' }}>
              ¿Listo para iniciar turno?
            </p>
          </div>
        </div>

        {!mensaje ? (
          <div style={styles.actionCard}>
            <h3 style={{ marginBottom: '1rem' }}>Registrar Entrada</h3>
            <form onSubmit={handleCheckIn}>
              <label style={styles.label}>¿Con quién trabajarás hoy?</label>
              <select
                style={styles.select}
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                required
              >
                <option value="">-- Selecciona al responsable --</option>
                {RESPONSABLES.map((resp, i) => (
                  <option key={i} value={resp}>
                    {resp}
                  </option>
                ))}
              </select>
              <button type="submit" style={styles.button} disabled={loading}>
                {loading ? 'Archivando...' : '📍 Enviar Check-in'}
              </button>
            </form>
          </div>
        ) : (
          <div style={{ ...styles.actionCard, textAlign: 'center' }}>
            <CheckCircle
              size={48}
              color="var(--color-success)"
              style={{ marginBottom: '1rem' }}
            />
            <h3>{mensaje}</h3>
            <p>Tu asistencia se guardó en la carpeta del mes actual.</p>
          </div>
        )}
      </main>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f4f6f9' },
  navbar: {
    backgroundColor: 'white',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer' },
  main: { padding: '1rem', maxWidth: '500px', margin: '0 auto' },
  headerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
    padding: '1rem',
  },
  avatar: { width: '60px', borderRadius: '50%' },
  actionCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 'bold',
    fontSize: '0.9rem',
  },
  select: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    marginBottom: '1.5rem',
    fontSize: '1rem',
    backgroundColor: 'white',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};

export default DashboardPasante;
