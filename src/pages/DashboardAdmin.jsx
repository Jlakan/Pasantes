import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { 
  collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDocs 
} from 'firebase/firestore'; 
import { logoutUser } from '../services/auth';
import { 
  LogOut, User, CheckCircle, Shield, Briefcase, 
  Settings, Save, X, RefreshCw 
} from 'lucide-react';

// Recibimos props para el switch de vistas
const DashboardAdmin = ({ esDobleRol, cambiarVista }) => {
  const [usuariosPendientes, setUsuariosPendientes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(false);

  // Estado para el Modal de Edición
  const [usuarioAEditar, setUsuarioAEditar] = useState(null);
  const [seleccion, setSeleccion] = useState({
    servicio_id: '',
    rol_asignar: 'pasante' // pasante, profesional, responsable
  });

  // 1. CARGAR USUARIOS PENDIENTES
  useEffect(() => {
    const q = query(
      collection(db, "Usuarios"), 
      where("estatus_cuenta", "==", "pendiente_asignacion")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsuariosPendientes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // 2. CARGAR LISTA DE SERVICIOS (Para el dropdown)
  useEffect(() => {
    const cargarServicios = async () => {
      try {
        const snap = await getDocs(collection(db, "CatalogoServicios"));
        setServicios(snap.docs.map(d => ({ id: d.id, ...d.data() }))); 
      } catch (e) { console.error("Error cargando servicios", e); }
    };
    cargarServicios();
  }, []);

  // --- FUNCIÓN PRINCIPAL: APROBAR Y ASIGNAR ---
  const handleGuardarCambios = async () => {
    if (!seleccion.servicio_id) return alert("Debes seleccionar un servicio.");
    setLoading(true);

    try {
      const servicioObj = servicios.find(s => s.id === seleccion.servicio_id);
      const uid = usuarioAEditar.id;

      // 1. DEFINIR LOS BOOLEANS SEGÚN EL ROL SELECCIONADO
      const flags = {
        isPasante: seleccion.rol_asignar === 'pasante',
        isProfessional: seleccion.rol_asignar === 'profesional' || seleccion.rol_asignar === 'responsable',
        isResponsable: seleccion.rol_asignar === 'responsable',
        // Nota: isAdmin no se asigna aquí por seguridad, se hace manual en DB
      };

      // 2. PREPARAR DATA PARA ACTUALIZAR USUARIO GLOBAL
      const datosActualizados = {
        ...flags,
        servicio_id: servicioObj.id, 
        servicio_nombre: servicioObj.nombre, 
        rol: seleccion.rol_asignar, 
        estatus_cuenta: 'activo',
        fecha_asignacion: new Date()
      };

      // A. Actualizar colección Usuarios (Global)
      await updateDoc(doc(db, "Usuarios", uid), datosActualizados);

      // B. Crear copia en la colección del Servicio
      const carpetaDestino = flags.isPasante ? "Pasantes" : "Profesionales";
      
      const perfilCompleto = { ...usuarioAEditar, ...datosActualizados };
      
      // Usamos setDoc con merge para asegurar creación
      await setDoc(doc(db, servicioObj.id, "Data", carpetaDestino, uid), perfilCompleto, { merge: true });

      // C. Limpieza
      setUsuarioAEditar(null);
      setSeleccion({ servicio_id: '', rol_asignar: 'pasante' });
      alert(`Usuario asignado correctamente a ${servicioObj.nombre}`);

    } catch (error) {
      console.error(error);
      alert("Error al asignar rol. Revisa la consola.");
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={{fontWeight:'bold', display:'flex', alignItems:'center', gap:'10px'}}>
            <Shield size={24} color="var(--color-primary)"/> Panel de Administración
        </div>
        
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            {/* --- BOTÓN NUEVO DEL SWITCH --- */}
            {esDobleRol && (
                <button 
                    onClick={cambiarVista}
                    style={{
                        padding: '8px 12px', 
                        fontSize: '0.8rem', 
                        cursor: 'pointer', 
                        borderRadius: '6px', 
                        border: '1px solid #555', 
                        background: '#333', 
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}
                >
                    <RefreshCw size={14}/> Ir a Responsable
                </button>
            )}

            <button onClick={logoutUser} style={styles.btnLogout} title="Cerrar Sesión">
                <LogOut size={18}/>
            </button>
        </div>
      </nav>

      <main style={styles.main}>
        <h2 style={{color:'#333'}}>Solicitudes de Ingreso ({usuariosPendientes.length})</h2>
        <p style={{color:'#666', marginBottom:'2rem'}}>Asigna roles y servicios a los nuevos usuarios.</p>

        {usuariosPendientes.length === 0 ? (
            <div style={styles.emptyState}>
                <CheckCircle size={48} color="#28a745" style={{marginBottom:'1rem'}}/>
                <p>¡Todo listo! No hay usuarios pendientes de aprobación.</p>
            </div>
        ) : (
            <div style={styles.grid}>
                {usuariosPendientes.map(u => (
                    <div key={u.id} style={styles.card}>
                        <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px'}}>
                            <div style={{background:'#eee', padding:'10px', borderRadius:'50%'}}>
                                <User size={24} color="#666"/>
                            </div>
                            <div>
                                <div style={{fontWeight:'bold'}}>{u.nombre}</div>
                                <div style={{fontSize:'0.85rem', color:'#666'}}>{u.email}</div>
                                <div style={{fontSize:'0.85rem', color:'var(--color-primary)'}}>{u.telefono}</div>
                            </div>
                        </div>
                        <button 
                            onClick={() => { setUsuarioAEditar(u); setSeleccion({...seleccion, servicio_id:''}); }}
                            style={styles.btnAction}
                        >
                            <Settings size={16}/> Asignar Rol
                        </button>
                    </div>
                ))}
            </div>
        )}
      </main>

      {/* MODAL DE ASIGNACIÓN */}
      {usuarioAEditar && (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <div style={styles.modalHeader}>
                    <h3>Asignar a: {usuarioAEditar.nombre}</h3>
                    <button onClick={()=>setUsuarioAEditar(null)} style={{border:'none', background:'none', cursor:'pointer'}}><X size={24}/></button>
                </div>
                
                <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                    {/* SELECTOR DE SERVICIO */}
                    <div>
                        <label style={styles.label}>Servicio / Área</label>
                        <select 
                            style={styles.input} 
                            value={seleccion.servicio_id} 
                            onChange={e => setSeleccion({...seleccion, servicio_id: e.target.value})}
                        >
                            <option value="">-- Selecciona --</option>
                            {servicios.map(s => (
                                <option key={s.id} value={s.id}>{s.nombre || s.id}</option>
                            ))}
                        </select>
                        {servicios.length === 0 && <small style={{color:'red'}}>No hay servicios en 'CatalogoServicios'.</small>}
                    </div>

                    {/* SELECTOR DE ROL */}
                    <div>
                        <label style={styles.label}>Rol a Desempeñar</label>
                        <div style={styles.roleGrid}>
                            <div 
                                style={seleccion.rol_asignar==='pasante' ? styles.roleCardActive : styles.roleCard}
                                onClick={()=>setSeleccion({...seleccion, rol_asignar:'pasante'})}
                            >
                                <User size={20}/> Pasante
                            </div>
                            <div 
                                style={seleccion.rol_asignar==='profesional' ? styles.roleCardActive : styles.roleCard}
                                onClick={()=>setSeleccion({...seleccion, rol_asignar:'profesional'})}
                            >
                                <Briefcase size={20}/> Staff
                            </div>
                            <div 
                                style={seleccion.rol_asignar==='responsable' ? styles.roleCardActive : styles.roleCard}
                                onClick={()=>setSeleccion({...seleccion, rol_asignar:'responsable'})}
                            >
                                <Shield size={20}/> Jefe/Resp.
                            </div>
                        </div>
                    </div>

                    <button onClick={handleGuardarCambios} style={styles.btnSave} disabled={loading}>
                        {loading ? 'Procesando...' : <><Save size={18}/> Confirmar y Activar</>}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f4f6f9' },
    navbar: { backgroundColor: '#1a1a1a', color:'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems:'center' },
    btnLogout: { background:'none', border:'none', color:'white', cursor:'pointer' },
    main: { padding: '2rem', maxWidth: '1000px', margin: '0 auto' },
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1rem' },
    card: { background:'white', padding:'1.5rem', borderRadius:'12px', boxShadow:'0 2px 4px rgba(0,0,0,0.05)' },
    emptyState: { textAlign:'center', padding:'4rem', color:'#999', border:'2px dashed #ddd', borderRadius:'12px' },
    btnAction: { width:'100%', padding:'10px', background:'var(--color-primary)', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', fontWeight:'bold' },
    
    // Modal
    modalOverlay: { position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000 },
    modalContent: { backgroundColor:'white', padding:'2rem', borderRadius:'16px', width:'90%', maxWidth:'500px' },
    modalHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', borderBottom:'1px solid #eee', paddingBottom:'10px' },
    label: { display:'block', marginBottom:'5px', fontWeight:'bold', fontSize:'0.9rem' },
    input: { width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', marginBottom:'1rem' },
    
    roleGrid: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'1.5rem' },
    roleCard: { border:'1px solid #ddd', padding:'10px', borderRadius:'8px', textAlign:'center', cursor:'pointer', fontSize:'0.8rem', color:'#666' },
    roleCardActive: { border:'2px solid var(--color-primary)', background:'#e8f0fe', padding:'10px', borderRadius:'8px', textAlign:'center', cursor:'pointer', fontSize:'0.8rem', fontWeight:'bold', color:'var(--color-primary)' },
    
    btnSave: { width:'100%', padding:'14px', background:'#28a745', color:'white', border:'none', borderRadius:'8px', fontSize:'1rem', fontWeight:'bold', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px' }
};

export default DashboardAdmin;