import React, { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import { 
  collection, query, where, onSnapshot, doc, updateDoc, 
  serverTimestamp, addDoc, getDocs, increment 
} from 'firebase/firestore'; 
import { LogOut, UserCheck, AlertTriangle, FileText, Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { logoutUser } from '../services/auth';

const getNombreCarpeta = (fecha) => {
    const mesNumero = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const mesNombre = fecha.toLocaleString('es-ES', { month: 'long' });
    return `${mesNumero}_${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}`;
};

const DashboardStaff = () => {
  const { user, userData } = useUser();
  const [solicitudes, setSolicitudes] = useState([]);
  const [vista, setVista] = useState('entradas'); // 'entradas' o 'reportes'
  
  // Estados para reporte
  const [pasantes, setPasantes] = useState([]);
  const [reporteForm, setReporteForm] = useState({ uid_pasante: '', gravedad: 'leve', descripcion: '' });

  // 1. ESCUCHAR SOLICITUDES (ENTRADA Y SALIDA)
  useEffect(() => {
    const hoy = new Date();
    const year = hoy.getFullYear().toString();
    const carpetaMes = getNombreCarpeta(hoy);
    
    // Escuchamos DONDE soy responsable Y el estatus es 'pendiente_validacion' O 'pendiente_salida'
    // Firebase no permite "OR" en queries simples fácilmente, así que traemos todo lo que sea para mí
    // y filtramos en cliente, o escuchamos la colección y filtramos.
    // Para eficiencia, escucharemos la colección del mes y filtraremos en memoria (client-side filtering)
    // ya que un usuario no tendrá miles de solicitudes simultáneas.
    
    const q = query(
        collection(db, "Asistencias", year, carpetaMes),
        where("uid_responsable", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const rawData = snapshot.docs.map(d => ({ 
            id: d.id, 
            path_year: year, 
            path_mes: carpetaMes, 
            ...d.data() 
        }));

        // Filtramos solo las que requieren acción
        const pendientes = rawData.filter(item => 
            item.estatus === 'pendiente_validacion' || item.estatus === 'pendiente_salida'
        );
        
        setSolicitudes(pendientes);
    }, () => setSolicitudes([]));

    return () => unsubscribe();
  }, [user.uid]);

  // 2. VALIDAR ENTRADA (Simple cambio de estatus)
  const validarEntrada = async (item, decision) => {
    try {
        await updateDoc(doc(db, "Asistencias", item.path_year, item.path_mes, item.id), {
            estatus: decision,
            hora_validacion: serverTimestamp()
        });
    } catch (e) { alert("Error al validar entrada"); }
  };

  // 3. VALIDAR SALIDA (Cálculo de horas + Suma al perfil)
  const validarSalida = async (item) => {
    if(!window.confirm(`¿Confirmar salida y sumar horas a ${item.nombre_pasante}?`)) return;

    try {
        // A. CALCULAR HORAS
        // item.hora_entrada y item.hora_salida son Timestamps de Firebase
        const entrada = item.hora_entrada.toDate();
        const salida = item.hora_salida.toDate();
        
        const diffMs = salida - entrada;
        const horasDecimales = diffMs / (1000 * 60 * 60);
        const horasFinales = Math.round(horasDecimales * 100) / 100; // Redondear 2 decimales

        // B. ACTUALIZAR ASISTENCIA (Cerrar el ciclo)
        const asistenciaRef = doc(db, "Asistencias", item.path_year, item.path_mes, item.id);
        await updateDoc(asistenciaRef, {
            estatus: 'finalizado',
            horas_sesion: horasFinales,
            validado_por: user.displayName
        });

        // C. SUMAR AL PERFIL DEL PASANTE (Incremento atómico)
        // Usamos userData.servicio_id para saber en qué carpeta buscar al pasante
        if (userData.servicio_id) {
            const perfilRef = doc(db, userData.servicio_id, "Data", "Pasantes", item.uid_pasante);
            await updateDoc(perfilRef, {
                horas_acumuladas: increment(horasFinales),
                ultima_asistencia: serverTimestamp()
            });
        }

    } catch (e) {
        console.error(e);
        alert("Error al procesar la salida. Verifica tu conexión.");
    }
  };

  // 4. CARGAR PASANTES (Para Reportes)
  useEffect(() => {
    if (userData.rol === 'jefe_servicio' && vista === 'reportes' && pasantes.length === 0 && userData.servicio_id) {
        const cargar = async () => {
            // Buscamos solo pasantes DE MI SERVICIO
            const q = collection(db, userData.servicio_id, "Data", "Pasantes");
            const snap = await getDocs(q);
            setPasantes(snap.docs.map(d => ({uid: d.id, nombre: d.data().nombre})));
        };
        cargar();
    }
  }, [userData, vista]);

  // 5. ENVIAR REPORTE
  const enviarReporte = async (e) => {
    e.preventDefault();
    if (!reporteForm.uid_pasante) return alert("Selecciona pasante");
    
    const pasanteNombre = pasantes.find(p => p.uid === reporteForm.uid_pasante)?.nombre;

    await addDoc(collection(db, "Reportes"), {
        ...reporteForm,
        nombre_pasante: pasanteNombre,
        uid_jefe: user.uid,
        nombre_jefe: user.displayName,
        servicio: userData.servicio_nombre,
        fecha: serverTimestamp(),
        estatus: 'activo'
    });
    alert("Reporte creado correctamente");
    setReporteForm({ uid_pasante: '', gravedad: 'leve', descripcion: '' });
  };

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div>
            <div style={{fontWeight:'bold'}}>
                {userData.rol === 'jefe_servicio' ? 'Jefatura' : 'Profesional'}
            </div>
            <div style={{fontSize:'0.8rem', color:'#666'}}>{userData.servicio_nombre}</div>
        </div>
        <button onClick={logoutUser} style={{background:'none', border:'none', cursor:'pointer'}}><LogOut size={18}/></button>
      </nav>

      {/* TABS PARA EL JEFE */}
      {userData.rol === 'jefe_servicio' && (
          <div style={styles.tabs}>
            <button style={vista==='entradas' ? styles.tabActive : styles.tab} onClick={()=>setVista('entradas')}>
                <UserCheck size={16}/> Validaciones
            </button>
            <button style={vista==='reportes' ? styles.tabActive : styles.tab} onClick={()=>setVista('reportes')}>
                <AlertTriangle size={16}/> Reportar Incidencia
            </button>
          </div>
      )}

      <main style={styles.main}>
        {/* VISTA 1: VALIDACIÓN DE ENTRADAS Y SALIDAS */}
        {vista === 'entradas' && (
            <div>
                <h2 style={{marginBottom:'1rem'}}>Solicitudes Pendientes ({solicitudes.length})</h2>
                {solicitudes.length === 0 && <div style={styles.emptyState}>Estás al día. No hay solicitudes.</div>}
                
                <div style={styles.grid}>
                    {solicitudes.map(soli => (
                        <div key={soli.id} style={{
                            ...styles.card, 
                            borderLeft: soli.estatus === 'pendiente_salida' ? '4px solid #f59e0b' : '4px solid var(--color-primary)'
                        }}>
                            <div style={{display:'flex', gap:'10px', alignItems:'center', marginBottom:'1rem'}}>
                                <img src={soli.foto_pasante} style={{width:40, borderRadius:'50%'}} alt="."/>
                                <div>
                                    <div style={{fontWeight:'bold'}}>{soli.nombre_pasante}</div>
                                    <div style={{fontSize:'0.8rem', color:'#666', display:'flex', alignItems:'center', gap:'4px'}}>
                                        {soli.estatus === 'pendiente_salida' ? (
                                            <span style={{color:'#d97706', fontWeight:'bold'}}>⚠️ SOLICITA SALIDA</span>
                                        ) : (
                                            <span>🔵 SOLICITA ENTRADA</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* INFORMACIÓN DE TIEMPOS */}
                            <div style={{background:'#f8f9fa', padding:'10px', borderRadius:'8px', fontSize:'0.85rem', marginBottom:'1rem'}}>
                                <div style={{display:'flex', justifyContent:'space-between'}}>
                                    <span>Entrada:</span>
                                    <strong>{soli.hora_entrada?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</strong>
                                </div>
                                {soli.estatus === 'pendiente_salida' && (
                                    <div style={{display:'flex', justifyContent:'space-between', marginTop:'5px', color:'#d97706'}}>
                                        <span>Salida marcada:</span>
                                        <strong>{soli.hora_salida?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</strong>
                                    </div>
                                )}
                            </div>

                            {/* BOTONES DE ACCIÓN */}
                            {soli.estatus === 'pendiente_salida' ? (
                                // ACCIONES DE SALIDA
                                <button onClick={()=>validarSalida(soli)} style={styles.btnFinish}>
                                    <CheckCircle size={16}/> Confirmar y Cerrar Turno
                                </button>
                            ) : (
                                // ACCIONES DE ENTRADA
                                <div style={{display:'flex', gap:'10px'}}>
                                    <button onClick={()=>validarEntrada(soli, 'rechazado')} style={styles.btnReject}>Rechazar</button>
                                    <button onClick={()=>validarEntrada(soli, 'aprobado')} style={styles.btnApprove}>Autorizar Entrada</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* VISTA 2: REPORTES (Solo Jefe) */}
        {vista === 'reportes' && userData.rol === 'jefe_servicio' && (
            <div style={styles.card}>
                <h3><FileText size={20} style={{verticalAlign:'middle'}}/> Nuevo Reporte de Conducta</h3>
                <form onSubmit={enviarReporte} style={{marginTop:'1rem', display:'flex', flexDirection:'column', gap:'1rem'}}>
                    <div>
                        <label style={styles.label}>Pasante implicado</label>
                        <select style={styles.input} value={reporteForm.uid_pasante} onChange={e=>setReporteForm({...reporteForm, uid_pasante: e.target.value})} required>
                            <option value="">Seleccionar del área...</option>
                            {pasantes.map(p => <option key={p.uid} value={p.uid}>{p.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={styles.label}>Nivel de Falta</label>
                        <select style={styles.input} value={reporteForm.gravedad} onChange={e=>setReporteForm({...reporteForm, gravedad: e.target.value})}>
                            <option value="leve">Leve (Llamada de atención)</option>
                            <option value="moderada">Moderada (Incumplimiento)</option>
                            <option value="grave">Grave (Acta administrativa)</option>
                        </select>
                    </div>
                    <div>
                        <label style={styles.label}>Descripción</label>
                        <textarea style={{...styles.input, height:'100px'}} value={reporteForm.descripcion} onChange={e=>setReporteForm({...reporteForm, descripcion: e.target.value})} required placeholder="Detalles del incidente..."/>
                    </div>
                    <button type="submit" style={styles.btnApprove}>Guardar Reporte</button>
                </form>
            </div>
        )}
      </main>
    </div>
  );
};

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f8f9fa' },
    navbar: { backgroundColor: 'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', alignItems:'center' },
    main: { padding: '2rem', maxWidth: '800px', margin: '0 auto' },
    tabs: { display:'flex', justifyContent:'center', gap:'1rem', padding:'1rem' },
    tab: { padding:'8px 16px', border:'none', background:'none', cursor:'pointer', display:'flex', gap:'5px', alignItems:'center', opacity:0.6 },
    tabActive: { padding:'8px 16px', border:'none', background:'white', borderRadius:'20px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)', cursor:'pointer', display:'flex', gap:'5px', alignItems:'center', fontWeight:'bold', color:'var(--color-primary)' },
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1rem' },
    card: { background:'white', padding:'1rem', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)' },
    emptyState: { textAlign:'center', color:'#999', padding:'2rem', border:'2px dashed #eee', borderRadius:'8px' },
    btnApprove: { flex:1, padding:'10px', border:'none', borderRadius:'6px', background:'var(--color-primary)', color:'white', cursor:'pointer', fontWeight:'bold' },
    btnReject: { flex:1, padding:'10px', border:'1px solid #ddd', borderRadius:'6px', background:'white', cursor:'pointer', color:'#d32f2f' },
    btnFinish: { width:'100%', padding:'10px', border:'none', borderRadius:'6px', background:'#f59e0b', color:'white', cursor:'pointer', fontWeight:'bold', display:'flex', justifyContent:'center', gap:'8px', alignItems:'center' },
    input: { width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd' },
    label: { fontSize:'0.9rem', fontWeight:'bold', marginBottom:'5px', display:'block' }
};

export default DashboardStaff;