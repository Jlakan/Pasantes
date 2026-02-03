import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
// Agregamos imports necesarios para leer servicios y crear documentos en subcolecciones
import { doc, updateDoc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore'; 
import { User, Briefcase, Shield } from 'lucide-react';

const RegistroData = () => {
  const { user } = useUser();
  const [servicios, setServicios] = useState([]); // Aquí guardaremos la lista de áreas (Psicología, etc.)
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    nombre: user.displayName || '',
    telefono: '',
    rol_solicitado: 'pasante',
    servicio_id: '' // <--- ESTO FALTABA: El ID del servicio elegido
  });

  // 1. CARGAR SERVICIOS DISPONIBLES (Creados por el Admin)
  useEffect(() => {
    const cargarServicios = async () => {
        try {
            const q = query(collection(db, "CatalogoServicios"), orderBy("nombre"));
            const snap = await getDocs(q);
            // Guardamos: { nombre: 'Psicología', collectionId: 'psicologia' }
            setServicios(snap.docs.map(d => d.data())); 
        } catch (error) {
            console.error("Error cargando servicios:", error);
        }
    };
    cargarServicios();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validación de seguridad
    if (!form.servicio_id) return alert("Por favor selecciona un Área/Servicio.");
    
    setLoading(true);

    try {
      // Buscamos el objeto completo del servicio para tener su nombre bonito
      const servicioObj = servicios.find(s => s.collectionId === form.servicio_id);

      // Datos Maestros del Perfil
      const perfilCompleto = {
        uid: user.uid,
        nombre: form.nombre,
        email: user.email,
        foto_url: user.photoURL,
        telefono: form.telefono,
        rol: form.rol_solicitado,
        estatus_cuenta: 'por_aprobar',
        registro_completo: true,
        
        // GUARDAMOS A QUÉ SERVICIO PERTENECE
        servicio_id: form.servicio_id,         // ej: 'psicologia'
        servicio_nombre: servicioObj.nombre    // ej: 'Psicología'
      };

      // PASO A: Actualizar colección Global 'Usuarios'
      await updateDoc(doc(db, "Usuarios", user.uid), perfilCompleto);

      // PASO B: Crear copia en la Colección Específica del Servicio
      // Define si va a la carpeta de Pasantes o Profesionales
      const subcoleccion = form.rol_solicitado === 'pasante' ? 'Pasantes' : 'Profesionales';
      
      // Ruta: /psicologia/Data/Pasantes/UID
      const docRefFinal = doc(db, form.servicio_id, "Data", subcoleccion, user.uid);
      
      await setDoc(docRefFinal, perfilCompleto);

      // Recargar para entrar
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
          Verifica tus datos y selecciona el área a la que perteneces.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* CAMPO 1: NOMBRE */}
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

          {/* CAMPO 2: TELÉFONO */}
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

          {/* CAMPO 3: SELECTOR DE SERVICIO (¡NUEVO!) */}
          <div>
            <label style={styles.label}>Área / Servicio Asignado</label>
            <select 
                style={styles.input} 
                value={form.servicio_id} 
                onChange={e => setForm({...form, servicio_id: e.target.value})} 
                required
            >
                <option value="">-- Selecciona tu área --</option>
                {servicios.map(s => (
                    <option key={s.collectionId} value={s.collectionId}>
                        {s.nombre}
                    </option>
                ))}
            </select>
            {servicios.length === 0 && <p style={{fontSize:'0.8rem', color:'red', marginTop:'5px'}}>No hay servicios cargados. Contacta al Admin.</p>}
          </div>

          {/* CAMPO 4: ROL */}
          <div>
            <label style={styles.label}>¿Cuál es tu función?</label>
            <div style={styles.roleGrid}>
              <div
                style={form.rol_solicitado === 'pasante' ? styles.roleCardActive : styles.roleCard}
                onClick={() => setForm({ ...form, rol_solicitado: 'pasante' })}
              >
                <User size={24} />
                <span>Pasante</span>
              </div>

              <div
                style={form.rol_solicitado === 'profesional' ? styles.roleCardActive : styles.roleCard}
                onClick={() => setForm({ ...form, rol_solicitado: 'profesional' })}
              >
                <Briefcase size={24} />
                <span>Profesional</span>
              </div>

              <div
                style={form.rol_solicitado === 'jefe_servicio' ? styles.roleCardActive : styles.roleCard}
                onClick={() => setForm({ ...form, rol_solicitado: 'jefe_servicio' })}
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
  container: { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f6f9', padding: '1rem' },
  card: { backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', width: '100%', maxWidth: '500px' },
  label: { display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' },
  input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' },
  button: { width: '100%', padding: '14px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
  roleGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  roleCard: { border: '2px solid #eee', borderRadius: '8px', padding: '15px 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer', color: '#888', transition: 'all 0.2s' },
  roleCardActive: { border: '2px solid var(--color-primary)', backgroundColor: '#e8f0fe', borderRadius: '8px', padding: '15px 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 'bold' },
};

export default RegistroData;