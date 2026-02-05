import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import { doc, setDocDoc } from 'firebase/firestore'; 
import { User, Phone } from 'lucide-react';

const RegistroData = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  
  // Estado simplificado: Solo Nombre y Teléfono
  const [form, setForm] = useState({
    nombre: user.displayName || '',
    telefono: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Datos del Perfil Inicial (Sin permisos)
      const perfilInicial = {
        uid: user.uid,
        email: user.email,
        foto_url: user.photoURL,
        
        // Datos ingresados
        nombre: form.nombre,
        telefono: form.telefono,
        
        // FLAGS DE SEGURIDAD (Todos en false al inicio)
        isAdmin: false,
        isProfessional: false,
        isResponsable: false, // El jefe de servicio tendrá isProfessional: true Y isResponsable: true
        isPasante: false,
        
        // Estado de la cuenta
        estatus_cuenta: 'pendiente_asignacion', // Esperando que el admin le de rol
        registro_completo: true, // Ya llenó el formulario, ahora le toca al admin
        
        // Campos vacíos por ahora (se llenarán desde el Admin Panel)
        servicio_id: null,
        servicio_nombre: null,
        rol: 'sin_asignar' 
      };

      // Actualizamos SOLO la colección Global 'Usuarios'
      await setDoc(doc(db, "Usuarios", user.uid), perfilInicial);

      // Recargar la página para que el UserContext lea los nuevos datos
      window.location.reload(); 

    } catch (error) {
      console.error('Error guardando datos:', error);
      alert('Hubo un error al guardar tu perfil. Intenta nuevamente.');
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{textAlign: 'center', marginBottom: '2rem'}}>
            <h2 style={{ color: 'var(--color-primary)', margin: 0 }}>
            Bienvenido a Nexus
            </h2>
            <p style={{ color: '#666', marginTop: '10px' }}>
            Para activar tu cuenta, por favor confirma tus datos de contacto.
            <br/>
            <small>Un administrador te asignará tu servicio y rol posteriormente.</small>
            </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* CAMPO 1: NOMBRE */}
          <div>
            <label style={styles.label}>Nombre Completo</label>
            <div style={styles.inputGroup}>
                <User size={20} color="#999" />
                <input
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                style={styles.input}
                placeholder="Ej: Juan Pérez González"
                />
            </div>
          </div>

          {/* CAMPO 2: TELÉFONO */}
          <div>
            <label style={styles.label}>Número de Celular</label>
            <div style={styles.inputGroup}>
                <Phone size={20} color="#999" />
                <input
                type="tel"
                required
                placeholder="Ej: 618 123 4567"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                style={styles.input}
                />
            </div>
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Guardando...' : 'Finalizar Registro'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f6f9', padding: '1rem' },
  card: { backgroundColor: 'white', padding: '2.5rem', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '450px' },
  label: { display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem', color: '#333' },
  inputGroup: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 15px', border: '1px solid #ddd', borderRadius: '10px', backgroundColor: '#fff' },
  input: { width: '100%', border: 'none', outline: 'none', fontSize: '1rem', color: '#333' },
  button: { width: '100%', padding: '16px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '1rem', transition: 'transform 0.1s' },
};

export default RegistroData;