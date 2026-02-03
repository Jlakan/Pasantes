// src/components/RoleSwitcher.jsx
import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Settings, User, Shield, Briefcase, Lock } from 'lucide-react';

const RoleSwitcher = () => {
  const { user, userData } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null; // No mostrar si no hay sesión iniciada

  const cambiarRol = async (nuevoRol) => {
    // Confirmación rápida
    // if (!window.confirm(`¿Cambiar vista a ${nuevoRol}?`)) return;

    try {
      // 1. Actualizamos tu rol real en la base de datos
      await updateDoc(doc(db, 'Usuarios', user.uid), {
        rol: nuevoRol,
        estatus_cuenta: 'activo', // Aseguramos que esté activo para que no te mande a "Espera"
      });

      // 2. Recargamos la página para que la App se reconstruya con tu nueva identidad
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Error al cambiar de rol');
    }
  };

  const roles = [
    { id: 'admin', label: 'Admin', icon: <Lock size={14} />, color: '#333' },
    {
      id: 'jefe_servicio',
      label: 'Jefe Servicio',
      icon: <Shield size={14} />,
      color: '#7b1fa2',
    },
    {
      id: 'profesional',
      label: 'Profesional',
      icon: <Briefcase size={14} />,
      color: '#1976d2',
    },
    {
      id: 'pasante',
      label: 'Pasante',
      icon: <User size={14} />,
      color: '#388e3c',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {/* MENÚ DESPLEGABLE */}
      {isOpen && (
        <div style={styles.menu}>
          <p style={styles.title}>SWITCH DE ROL (DEV)</p>
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => cambiarRol(r.id)}
              style={{
                ...styles.roleBtn,
                backgroundColor: userData?.rol === r.id ? r.color : 'white',
                color: userData?.rol === r.id ? 'white' : '#333',
                borderColor: userData?.rol === r.id ? r.color : '#eee',
              }}
            >
              {r.icon} {r.label}
            </button>
          ))}
        </div>
      )}

      {/* BOTÓN FLOTANTE PRINCIPAL */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.fab}
        title="Cambiar Rol de Usuario"
      >
        <Settings size={24} />
      </button>
    </div>
  );
};

const styles = {
  fab: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    backgroundColor: '#222',
    color: 'white',
    border: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s',
  },
  menu: {
    marginBottom: '10px',
    backgroundColor: 'white',
    padding: '10px',
    borderRadius: '12px',
    boxShadow: '0 5px 20px rgba(0,0,0,0.15)',
    width: '160px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  title: {
    fontSize: '0.7rem',
    fontWeight: 'bold',
    color: '#999',
    textAlign: 'center',
    margin: '0 0 5px 0',
    letterSpacing: '1px',
  },
  roleBtn: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #eee',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
    fontWeight: '500',
    transition: 'all 0.2s',
    textAlign: 'left',
  },
};

export default RoleSwitcher;
