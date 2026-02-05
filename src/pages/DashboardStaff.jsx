import React, { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import { 
  collection, query, where, onSnapshot, doc, updateDoc, 
  serverTimestamp, addDoc, getDocs, increment, orderBy 
} from 'firebase/firestore'; 
import { 
  LogOut, UserCheck, AlertTriangle, CheckCircle, 
  Users, Eye, X, AlertCircle, Shield 
} from 'lucide-react';
import { logoutUser } from '../services/auth';

const getNombreCarpeta = (fecha) => {
    const mesNumero = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const mesNombre = fecha.toLocaleString('es-ES', { month: 'long' });
    return `${mesNumero}_${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}`;
};

// Recibimos props para el switch de vistas
const DashboardStaff = ({ esAdminModoUsuario, cambiarVista }) => {
  const { user, userData } = useUser();
  const [solicitudes, setSolicitudes] = useState([]);
  const [vista, setVista] = useState('entradas'); 
  
  // Datos Generales
  const [pasantes, setPasantes] = useState([]); 
  const [reporteForm, setReporteForm] = useState({ uid_pasante: '', gravedad: 'leve', descripcion: '' });

  // ESTADOS PARA EL EXPEDIENTE (MODAL)
  const [pasanteSeleccionado, setPasanteSeleccionado] = useState(null);
  const [historialReportes, setHistorialReportes] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  // 1. ESCUCHAR SOLICITUDES (Entradas/Salidas)
  useEffect(() => {
    if (!user?.uid) return;
    
    const hoy = new Date();
    const year = hoy.getFullYear().toString();
    const carpetaMes = getNombreCarpeta(hoy);
    
    // Escuchar colección del mes
    // Nota: Filtramos en cliente para simplificar índices, 
    // pero idealmente deberías tener un índice compuesto en Firestore
    const q = query(collection(db, "Asistencias", year, carpetaMes), where("uid_responsable", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const pendientes = snapshot.docs
            .map(d => ({ id: d.id, path_year: year, path_mes: carpetaMes, ...d.data() }))
            .filter(item => item.estatus === 'pendiente_validacion' || item.estatus === 'pendiente_salida');
        setSolicitudes(pendientes);
    }, () => setSolicitudes([]));

    return () => unsubscribe();
  }, [user.uid]);

  // 2. CARGAR LISTA DE PASANTES (Para tab "Mis Pasantes" y select "Reportes")
  useEffect(() => {
    if (userData.servicio_id && (vista === 'pasantes' || vista === 'reportes')) {
        const q = collection(db, userData.servicio_id, "Data", "Pasantes");
        const unsubscribe = onSnapshot(q, (snap) => {
            setPasantes(snap.docs.map(d => ({uid: d.id, ...d.data()})));
        });
        return () => unsubscribe();
    }
  }, [userData, vista]);

  // 3. CARGAR EXPEDIENTE (Cuando seleccionas a alguien)
  useEffect(() => {
    if (!pasanteSeleccionado) {
        setHistorialReportes([]);
        return;
    }
    setCargandoHistorial(true);

    const q = query(
        collection(db, "Reportes"), 
        where("uid_pasante", "==", pasanteSeleccionado.uid),
        orderBy("fecha", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        setHistorialReportes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setCargandoHistorial(false);
    });

    return () => unsubscribe();
  }, [pasanteSeleccionado]);


  // --- FUNCIONES ACCIONES ---
  const validarEntrada = async (item, decision) => {
    try {
        await updateDoc(doc(db, "Asistencias", item.path_year, item.path_mes, item.id), { estatus: decision, hora_validacion: serverTimestamp() });
    } catch (e) { alert("Error al validar entrada"); }
  };

  const validarSalida = async (item) => {
    if(!window.confirm(`¿Cerrar turno de ${item.nombre_pasante}?`)) return;
    try {
        // Calculamos horas basados en la hora que el alumno marcó salida y la hora de entrada
        const diffMs = item.hora_salida.toDate() - item.hora_entrada.toDate();
        const horas = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        
        await updateDoc(doc(db, "Asistencias", item.path_year, item.path_mes, item.id), {
            estatus: 'finalizado', horas_sesion: horas, validado_por: user.displayName
        });

        if (userData.servicio_id) {
            await updateDoc(doc(db, userData.servicio_id, "Data", "Pasantes", item.uid_pasante), {
                horas_acumuladas: increment(horas), ultima_asistencia: serverTimestamp()
            });
        }
    } catch (e) { console.error(e); }
  };

  const enviarReporte = async (e) => {
    e.preventDefault();
    if (!reporteForm.uid_pasante) return alert("Selecciona pasante");
    const pasanteObj = pasantes.find(p => p.uid === reporteForm.uid_pasante);
    
    await addDoc(collection(db, "Reportes"), {
        ...reporteForm, 
        nombre_pasante: pasanteObj?.nombre,
        foto_pasante: pasanteObj?.foto_url,
        uid_jefe: user.uid, 
        nombre_jefe: user.displayName,
        servicio: userData.servicio_nombre, 
        fecha: serverTimestamp(), 
        estatus: 'activo'
    });
    alert("Reporte guardado en el expediente.");
    setReporteForm({ uid_pasante: '', gravedad: 'leve', descripcion: '' });
  };

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div>
            <div style={{fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px'}}>
                {esAdminModoUsuario && <Shield size={16} color="#f59e0b"/>}
                {(userData.rol === 'jefe_servicio' || userData.isResponsable) ? 'Jefatura' : 'Profesional'}
            </div>
            <div style={{fontSize:'0.8rem', color:'#666'}}>{userData.servicio_nombre}</div>
        </div>

        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            {/* --- BOTÓN PARA VOLVER A ADMIN --- */}
            {esAdminModoUsuario && (
                <button 
                    onClick={cambiarVista}
                    style={{
                        background: '#333', color: 'white', border: 'none', 
                        padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                >
                    <Shield size={14}/> Volver a Admin
                </button>
            )}

            <button onClick={logoutUser} style={{background:'none', border:'none', cursor:'pointer'}}><LogOut size={18}/></button>
        </div>
      </nav>

      {/* TABS DE NAVEGACIÓN */}
      <div style={styles.tabs}>
        <button style={vista==='entradas'?styles.tabActive:styles.tab} onClick={()=>setVista('entradas')}><UserCheck size={16}/> Pendientes</button>
        
        {/* Solo mostramos gestión de pasantes si es Jefe o Responsable */}
        {(userData.rol === 'jefe_servicio' || userData.isResponsable) && (
            <>
                <button style={vista==='pasantes'?styles.tabActive:styles.tab} onClick={()=>setVista('pasantes')}><Users size={16}/> Mis Pasantes</button>
                <button style={vista==='reportes'?styles.tabActive:styles.tab} onClick={()=>setVista('reportes')}><AlertTriangle size={16}/> Crear Reporte</button>
            </>
        )}
      </div>

      <main style={styles.main}>
        
        {/* VISTA 1: ENTRADAS */}
        {vista === 'entradas' && (
            <div>
                <h2 style={{marginBottom:'1rem'}}>Solicitudes ({solicitudes.length})</h2>
                {solicitudes.length === 0 && <div style={styles.emptyState}>Estás al día.</div>}
                <div style={styles.grid}>
                    {solicitudes.map(soli => (
                        <div key={soli.id} style={{...styles.card, borderLeft: soli.estatus === 'pendiente_salida' ? '4px solid #f59e0b' : '4px solid var(--color-primary)'}}>
                            <div style={{fontWeight:'bold', marginBottom:'5px'}}>{soli.nombre_pasante}</div>
                            <div style={{fontSize:'0.85rem', color:'#666', marginBottom:'10px'}}>
                                {soli.estatus === 'pendiente_salida' ? '⚠️ Solicita Salida' : '🔵 Solicita Entrada'}
                            </div>
                            {/* Información de Hora */}
                            <div style={{fontSize:'0.8rem', marginBottom:'10px', background:'#f8f9fa', padding:'5px', borderRadius:'4px'}}>
                                {soli.hora_entrada?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                {soli.estatus === 'pendiente_salida' && ` - ${soli.hora_salida?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                            </div>

                            {soli.estatus === 'pendiente_salida' ? (
                                <button onClick={()=>validarSalida(soli)} style={styles.btnFinish}>Confirmar y Cerrar</button>
                            ) : (
                                <div style={{display:'flex', gap:'5px'}}>
                                    <button onClick={()=>validarEntrada(soli, 'rechazado')} style={styles.btnReject}>X</button>
                                    <button onClick={()=>validarEntrada(soli, 'aprobado')} style={styles.btnApprove}>Aceptar</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* VISTA 2: LISTA DE PASANTES */}
        {vista === 'pasantes' && (
            <div>
                <h2 style={{marginBottom:'1rem'}}>Mi Equipo</h2>
                <div style={styles.grid}>
                    {pasantes.map(p => (
                        <div key={p.uid} style={styles.card}>
                            <div style={{display:'flex', gap:'10px'}}>
                                <img src={p.foto_url} style={{width:50, height:50, borderRadius:'50%'}} alt="."/>
                                <div>
                                    <div style={{fontWeight:'bold'}}>{p.nombre}</div>
                                    <div style={{fontSize:'0.8rem', color:'#666'}}>{p.telefono}</div>
                                    <div style={{marginTop:'5px', fontWeight:'bold', color:'var(--color-primary)'}}>
                                        {(p.horas_acumuladas || 0).toFixed(1)} hrs
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setPasanteSeleccionado(p)}
                                style={styles.btnOutline}
                            >
                                <Eye size={16}/> Ver Expediente
                            </button>
                        </div>
                    ))}
                    {pasantes.length === 0 && <p style={{color:'#999'}}>No hay pasantes registrados.</p>}
                </div>
            </div>
        )}

        {/* VISTA 3: CREAR REPORTE */}
        {vista === 'reportes' && (
            <div style={styles.card}>
                <h3>Nuevo Reporte de Incidencia</h3>
                <form onSubmit={enviarReporte} style={{marginTop:'1rem', display:'flex', flexDirection:'column', gap:'1rem'}}>
                    <select style={styles.input} value={reporteForm.uid_pasante} onChange={e=>setReporteForm({...reporteForm, uid_pasante: e.target.value})} required>
                        <option value="">Seleccionar Pasante...</option>
                        {pasantes.map(p => <option key={p.uid} value={p.uid}>{p.nombre}</option>)}
                    </select>
                    <select style={styles.input} value={reporteForm.gravedad} onChange={e=>setReporteForm({...reporteForm, gravedad: e.target.value})}>
                        <option value="leve">Leve (Llamada de atención)</option>
                        <option value="moderada">Moderada (Incumplimiento)</option>
                        <option value="grave">Grave (Acta administrativa)</option>
                    </select>
                    <textarea style={{...styles.input, height:'100px'}} value={reporteForm.descripcion} onChange={e=>setReporteForm({...reporteForm, descripcion: e.target.value})} placeholder="Describe detalladamente el suceso..." required/>
                    <button type="submit" style={styles.btnApprove}>Guardar en Expediente</button>
                </form>
            </div>
        )}
      </main>

      {/* --- MODAL DE EXPEDIENTE --- */}
      {pasanteSeleccionado && (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #eee', paddingBottom:'1rem', marginBottom:'1rem'}}>
                    <h3 style={{margin:0}}>Expediente del Pasante</h3>
                    <button onClick={() => setPasanteSeleccionado(null)} style={{background:'none', border:'none', cursor:'pointer'}}>
                        <X size={24} color="#666"/>
                    </button>
                </div>

                <div style={{display:'flex', gap:'1rem', alignItems:'center', marginBottom:'2rem'}}>
                    <img src={pasanteSeleccionado.foto_url} style={{width:60, height:60, borderRadius:'50%'}} alt="."/>
                    <div>
                        <h2 style={{margin:0, fontSize:'1.2rem'}}>{pasanteSeleccionado.nombre}</h2>
                        <p style={{margin:0, color:'#666'}}>{pasanteSeleccionado.email}</p>
                        <div style={{marginTop:'5px', display:'inline-block', background:'#e8f0fe', color:'var(--color-primary)', padding:'2px 8px', borderRadius:'10px', fontSize:'0.8rem', fontWeight:'bold'}}>
                            Total Acumulado: {pasanteSeleccionado.horas_acumuladas?.toFixed(1) || 0} horas
                        </div>
                    </div>
                </div>

                <h4 style={{display:'flex', alignItems:'center', gap:'8px'}}>
                    <AlertCircle size={18}/> Historial de Reportes
                </h4>
                
                <div style={styles.historialContainer}>
                    {cargandoHistorial ? <p>Cargando notas...</p> : historialReportes.length === 0 ? (
                        <div style={{textAlign:'center', padding:'2rem', color:'#999', fontStyle:'italic'}}>
                            Este pasante tiene un expediente limpio.
                        </div>
                    ) : (
                        historialReportes.map(repo => (
                            <div key={repo.id} style={{
                                ...styles.reporteItem, 
                                borderLeft: repo.gravedad === 'grave' ? '4px solid #d32f2f' : repo.gravedad === 'moderada' ? '4px solid #f59e0b' : '4px solid #1976d2'
                            }}>
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                                    <span style={{
                                        textTransform:'uppercase', fontSize:'0.7rem', fontWeight:'bold', 
                                        color: repo.gravedad === 'grave' ? '#d32f2f' : repo.gravedad === 'moderada' ? '#f59e0b' : '#1976d2'
                                    }}>
                                        FALTA {repo.gravedad}
                                    </span>
                                    <span style={{fontSize:'0.75rem', color:'#999'}}>
                                        {repo.fecha?.toDate().toLocaleDateString()}
                                    </span>
                                </div>
                                <p style={{margin:'0 0 5px 0', fontSize:'0.9rem', color:'#333'}}>{repo.descripcion}</p>
                                <div style={{fontSize:'0.75rem', color:'#888', fontStyle:'italic'}}>
                                    Reportó: {repo.nombre_jefe}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f8f9fa' },
    navbar: { backgroundColor: 'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', alignItems:'center' },
    main: { padding: '2rem', maxWidth: '800px', margin: '0 auto' },
    tabs: { display:'flex', justifyContent:'center', gap:'1rem', padding:'1rem', flexWrap:'wrap' },
    tab: { padding:'8px 16px', border:'none', background:'none', cursor:'pointer', display:'flex', gap:'5px', alignItems:'center', opacity:0.6 },
    tabActive: { padding:'8px 16px', border:'none', background:'white', borderRadius:'20px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)', cursor:'pointer', display:'flex', gap:'5px', alignItems:'center', fontWeight:'bold', color:'var(--color-primary)' },
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1rem' },
    card: { background:'white', padding:'1rem', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)' },
    emptyState: { textAlign:'center', color:'#999', padding:'2rem', border:'2px dashed #eee', borderRadius:'8px' },
    
    // Botones
    btnApprove: { flex:1, padding:'10px', border:'none', borderRadius:'6px', background:'var(--color-primary)', color:'white', cursor:'pointer', fontWeight:'bold' },
    btnReject: { flex:1, padding:'10px', border:'1px solid #ddd', borderRadius:'6px', background:'white', cursor:'pointer', color:'#d32f2f' },
    btnFinish: { width:'100%', padding:'10px', border:'none', borderRadius:'6px', background:'#f59e0b', color:'white', cursor:'pointer', fontWeight:'bold' },
    btnOutline: { marginTop:'1rem', width:'100%', padding:'8px', background:'white', border:'1px solid var(--color-primary)', color:'var(--color-primary)', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', fontWeight:'500' },
    
    input: { width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd' },
    
    // Modal Styles
    modalOverlay: { position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000, padding:'1rem' },
    modalContent: { backgroundColor:'white', padding:'2rem', borderRadius:'16px', width:'100%', maxWidth:'500px', maxHeight:'80vh', overflowY:'auto' },
    historialContainer: { background:'#f8f9fa', borderRadius:'8px', padding:'1rem', maxHeight:'300px', overflowY:'auto' },
    reporteItem: { background:'white', padding:'10px', borderRadius:'6px', marginBottom:'10px', border:'1px solid #eee' }
};

export default DashboardStaff;