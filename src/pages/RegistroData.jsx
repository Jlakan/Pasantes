// src/pages/RegistroData.jsx
import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { User, Briefcase, Shield } from 'lucide-react';

const RegistroData = () => {
  const { user } = useUser(); // Datos de Google
  const [form, setForm] = useState({
    nombre: user.displayName || '', // Pre-llenamos con lo que tenga Google
    telefono: '',
    rol_solicitado: 'pasante',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userRef = doc(db, 'Usuarios', user.uid);

      await updateDoc(userRef, {
        nombre: form.nombre, // Guardamos el nombre corregido
        telefono: form.telefono,
        rol: form.rol_solicitado,
        estatus_cuenta: 'por_aprobar',
        registro_completo: true,
      });

      window.location.reload();
    } catch (error) {
      console.error('Error guardando datos:', error);
      alert('Hubo un error al guardar tu perfil.');
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>
          Completa tu Perfil
        </h2>
        <p style={{ color: '#666', marginBottom: '2rem' }}>
          Hola. Antes de ingresar, verifica que tu nombre sea correcto y
          completa tus datos de contacto.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
        >
          {/* NUEVO CAMPO: NOMBRE */}
          <div>
            <label style={styles.label}>Nombre Completo (Real)</label>
            <input
              type="text"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              style={styles.input}
              placeholder="Ej: Juan Pérez González"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label style={styles.label}>Número de Celular</label>
            <input
              type="tel"
              required
              placeholder="Ej: 618 123 4567"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              style={styles.input}
            />
          </div>

          {/* Selector de Rol */}
          <div>
            <label style={styles.label}>¿Cuál es tu función en CEREDI?</label>
            <div style={styles.roleGrid}>
              <div
                style={
                  form.rol_solicitado === 'pasante'
                    ? styles.roleCardActive
                    : styles.roleCard
                }
                onClick={() => setForm({ ...form, rol_solicitado: 'pasante' })}
              >
                <User size={24} />
                <span>Pasante</span>
              </div>

              <div
                style={
                  form.rol_solicitado === 'profesional'
                    ? styles.roleCardActive
                    : styles.roleCard
                }
                onClick={() =>
                  setForm({ ...form, rol_solicitado: 'profesional' })
                }
              >
                <Briefcase size={24} />
                <span>Profesional</span>
              </div>

              <div
                style={
                  form.rol_solicitado === 'jefe_servicio'
                    ? styles.roleCardActive
                    : styles.roleCard
                }
                onClick={() =>
                  setForm({ ...form, rol_solicitado: 'jefe_servicio' })
                }
              >
                <Shield size={24} />
                <span>Jefe Servicio</span>
              </div>
            </div>
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Guardando...' : 'Enviar Solicitud'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f6f9',
    padding: '1rem',
  },
  card: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
    width: '100%',
    maxWidth: '500px',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 'bold',
    fontSize: '0.9rem',
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '1rem',
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
  roleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  roleCard: {
    border: '2px solid #eee',
    borderRadius: '8px',
    padding: '15px 5px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
    color: '#888',
    transition: 'all 0.2s',
  },
  roleCardActive: {
    border: '2px solid var(--color-primary)',
    backgroundColor: '#e8f0fe',
    borderRadius: '8px',
    padding: '15px 5px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
    color: 'var(--color-primary)',
    fontWeight: 'bold',
  },
};

export default RegistroData;
