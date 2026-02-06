import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import { 
  collection, addDoc, doc, onSnapshot, serverTimestamp, 
  getDocs, updateDoc, query, where 
} from 'firebase/firestore'; 
import { LogOut, Loader2, Clock, Award, LogIn, Calendar, AlertTriangle, Coffee, HelpCircle } from 'lucide-react';
import { logoutUser } from '../services/auth';

const DashboardPasante = () => {
  const { user, userData } = useUser();
  
  // --- DATOS ---
  const [responsables, setResponsables] = useState([]);
  const [responsableId, setResponsableId] = useState('');
  
  // --- ESTADOS ASISTENCIA ---
  const [asistenciaHoy, setAsistenciaHoy] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  
  // --- PROGRESO (Regresado de V1) ---
  const [misHoras, setMisHoras] = useState(0);

  // --- LÓGICA DE HORARIO DINÁMICO (V2) ---
  const [configDiaHoy, setConfigDiaHoy] = useState(null); // null si no existe, objeto si existe
  const [estatusTiempo, setEstatusTiempo] = useState('puntual'); // puntual | retardo

  // 1. CARGAR STAFF
  useEffect(() => {
    const cargarStaff = async () => {
      if (!userData?.servicio_id) return;
      try {
        const rutaColeccion = collection(db, userData.servicio_id, "Data", "Profesionales");
        const snapshot = await getDocs(rutaColeccion);
        setResponsables(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
      } catch (error) { console.error("Error staff", error); }
    };
    cargarStaff();
  }, [userData]);

  // 2. ESCUCHAR MIS HORAS ACUMULADAS (Vital para la StatsCard)
  useEffect(() => {
    if (!userData?.servicio_id) return;
    const docRef = doc(db, userData.servicio_id, "Data", "Pasantes", user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            setMisHoras(docSnap.data().horas_acumuladas || 0);
        }
    });
    return () => unsubscribe();
  }, [userData, user.uid]);

  // 3. VALIDAR DÍA Y HORA ACTUAL (Lógica de Retardos)
  useEffect(() => {
      const validarTiempo = () => {
          const hoy = new Date();
          const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
          const diaNombre = diasSemana[hoy.getDay()];

          // Extraemos el objeto horario
          const horarioGlobal = userData?.horario || {};
          const configHoy = horarioGlobal[diaNombre]; // Puede ser undefined

          setConfigDiaHoy(configHoy || null); // Guardamos null explícito si no hay config

          // Si hoy toca trabajar, calculamos tolerancia
          if (configHoy && configHoy.activo && configHoy.entrada) {
              const [horaEntrada, minEntrada] = configHoy.entrada.split(':');
              
              const fechaEntrada = new Date();
              fechaEntrada.setHours(parseInt(horaEntrada), parseInt(minEntrada), 0);
              
              // 20 minutos de tolerancia
              const fechaLimite = new Date(fechaEntrada.getTime() + 20 * 60000); 

              if (hoy > fechaLimite) {
                  setEstatusTiempo('retardo');
              } else {
                  setEstatusTiempo('puntual');
              }
          }
      };

      validarTiempo();
      const interval = setInterval(validarTiempo, 60000);
      return () => clearInterval(interval);
  }, [userData]);

  // 4. DETECTAR SI YA HIZO CHECK-IN
  useEffect(() => {
    const hoy = new Date();
    const year = hoy.getFullYear().toString();
    const nombreCarpetaMes = obtenerNombreCarpeta(hoy);

    const q = query(
        collection(db, "Asistencias", year, nombreCarpetaMes),
        where("uid_pasante", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const registros = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            registros.sort((a, b) => (b.hora_entrada?.seconds || 0) - (a.hora_entrada?.seconds || 0));

            const ultimoRegistro = registros[0];
            const fechaDoc = ultimoRegistro.hora_entrada?.toDate();
            const esMismoDia = fechaDoc && fechaDoc.getDate() === hoy.getDate();

            if (esMismoDia && (ultimoRegistro.estatus !== 'finalizado' && ultimoRegistro.estatus !== 'rechazado')) {
                setAsistenciaHoy(ultimoRegistro);
            } else {
                setAsistenciaHoy(null);
            }
        } else {
            setAsistenciaHoy(null);
        }
        setCargandoEstado(false);
    }, () => setCargandoEstado(false));

    return () => unsubscribe();
  }, [user.uid]);

  const obtenerNombreCarpeta = (fecha) => {
    const mesNombre = fecha.toLocaleString('es-ES', { month: 'long' });
    const mesNumero = (fecha.getMonth() + 1).toString().padStart(2, '0');
    return `${mesNumero}_${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}`;
  };

  // --- ACCIONES ---
  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!responsableId) return alert("Selecciona un responsable");
    
    // Alerta si NO tiene horario configurado o es día libre
    if (!configDiaHoy || !configDiaHoy.activo) {
        if(!window.confirm("No tienes un horario laboral asignado para hoy. ¿Registrar asistencia de todos modos?")) return;
    }

    setLoading(true);

    try {
      const responsableObj = responsables.find(r => r.uid === responsableId);
      const hoy = new Date();
      const year = hoy.getFullYear().toString();
      const nombreCarpetaMes = obtenerNombreCarpeta(hoy);

      await addDoc(collection(db, "Asistencias", year, nombreCarpetaMes), {
        uid_pasante: user.uid,
        nombre_pasante: user.displayName,
        foto_pasante: user.photoURL,
        servicio: userData.servicio_nombre,
        
        uid_responsable: responsableId, 
        nombre_responsable: responsableObj.nombre,
        
        hora_entrada: serverTimestamp(),
        hora_salida: null, 
        
        // Datos de control
        estatus_tiempo: estatusTiempo,
        horario_asignado: (configDiaHoy && configDiaHoy.activo) ? `${configDiaHoy.entrada} - ${configDiaHoy.salida}` : 'Fuera de Horario',
        
        tipo: 'turno_variable',
        estatus: 'pendiente_validacion'
      });
    } catch (error) { console.error(error); alert("Error al registrar"); }
    setLoading(false);
  };

  const handleRequestCheckOut = async () => {
    if (!window.confirm("¿Confirmar salida?")) return;
    setLoading(true);
    try {
        const hoy = new Date();
        const year = hoy.getFullYear().toString();
        const nombreCarpetaMes = obtenerNombreCarpeta(hoy);
        
        await updateDoc(doc(db, "Asistencias", year, nombreCarpetaMes, asistenciaHoy.id), {
            hora_salida: serverTimestamp(),
            estatus: 'pendiente_salida' 
        });

    } catch (error) { console.error(error); }
    setLoading(false);
  };

  if (cargandoEstado) return <div style={styles.centerContainer}><Loader2 size={48} className="spin" style={{color:'#ccc'}}/></div>;

  // --- HELPERS VISUALES PARA HORARIO ---
  const getBadgeHorario = () => {
      if (!configDiaHoy) return <span style={{...styles.badge, background:'#fff3e0', color:'#e65100'}}>Sin horario</span>;
      if (!configDiaHoy.activo) return <span style={{...styles.badge, background:'#e3f2fd', color:'#1565c0'}}>Día Libre</span>;
      return <span style={{...styles.badge, background:'#e8f5e9', color:'green'}}>Laboral</span>;
  };

  const getTextoHorario = () => {
      if (!configDiaHoy) return "No asignado";
      if (!configDiaHoy.activo) return "Descanso";
      return `${configDiaHoy.entrada} - ${configDiaHoy.salida}`;
  };

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={{fontWeight: 'bold', fontSize:'1rem'}}>Nexus {userData?.servicio_nombre}</div>
        <button onClick={logoutUser} style={{border:'none', background:'transparent', cursor:'pointer'}}><LogOut size={20} color="#666"/></button>
      </nav>

      <main style={styles.main}>
        
        {/* 1. STATS CARD (RECUPERADA DE V1) */}
        <div style={styles.statsCard}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                    <p style={{margin:0, fontSize:'0.75rem', color:'#888', fontWeight:'bold', textTransform:'uppercase', letterSpacing:'0.5px'}}>Total Acumulado</p>
                    <h2 style={{margin:'5px 0 0 0', color:'var(--color-primary)', fontSize:'2rem', lineHeight:'1'}}>
                        {misHoras.toFixed(2)} <span style={{fontSize:'1rem', fontWeight:'normal', color:'#666'}}>hrs</span>
                    </h2>
                </div>
                <div style={{background:'#e8f0fe', padding:'12px', borderRadius:'50%'}}>
                    <Award size={28} color="var(--color-primary)"/>
                </div>
            </div>
        </div>

        {/* 2. TARJETA DE HORARIO (LÓGICA V2/V3) */}
        <div style={styles.scheduleCard}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                 <span style={{fontSize:'0.8rem', fontWeight:'bold', color:'#555', display:'flex', gap:'5px', alignItems:'center'}}>
                    <Calendar size={14}/> HORARIO DE HOY
                 </span>
                 {getBadgeHorario()}
             </div>
             <div style={{fontSize:'1.1rem', fontWeight:'bold', color:'#333'}}>
                 {getTextoHorario()}
             </div>
        </div>

        {/* 3. ÁREA DE ACCIÓN (CHECK-IN / STATUS) */}
        {asistenciaHoy ? (
             asistenciaHoy.estatus === 'pendiente_validacion' ? (
                <div style={styles.cardCenter}>
                    <Loader2 size={48} className="spin" style={{color:'var(--color-primary)', marginBottom:'1rem'}}/>
                    <h3>Solicitando Entrada...</h3>
                    <p>Notificando a: <strong>{asistenciaHoy.nombre_responsable}</strong></p>
                    {asistenciaHoy.estatus_tiempo === 'retardo' && (
                        <div style={styles.tagRetardo}>Registrado con Retardo (>20 min)</div>
                    )}
                </div>
             ) 
             : asistenciaHoy.estatus === 'pendiente_salida' ? (
                <div style={styles.cardCenter}>
                    <Loader2 size={48} className="spin" style={{color:'#f59e0b', marginBottom:'1rem'}}/>
                    <h3 style={{color:'#d97706'}}>Validando Salida...</h3>
                    <p style={{fontSize:'0.9rem', color:'#666'}}>Tu responsable debe confirmar horas.</p>
                </div>
             )
             : asistenciaHoy.estatus === 'aprobado' ? (
                <div style={{...styles.cardCenter, borderTop:'4px solid var(--color-success)'}}>
                    <h2 style={{color:'var(--color-success)'}}>Turno Activo</h2>
                    <p style={{fontSize:'2.5rem', fontWeight:'bold', margin:'1rem 0', fontFamily:'monospace'}}>
                        {asistenciaHoy.hora_entrada?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    <p style={{color:'#666', marginTop:0}}>Hora de Entrada</p>

                    {asistenciaHoy.estatus_tiempo === 'retardo' && <span style={styles.tagRetardo}>Entrada con Retardo</span>}
                    
                    <button onClick={handleRequestCheckOut} style={styles.btnWarning} disabled={loading}>
                        {loading ? 'Procesando...' : '✋ Solicitar Salida'}
                    </button>
                </div>
             ) : null
        ) : (
            // FORMULARIO DE CHECK-IN
            <div style={styles.card}>
                <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'1.5rem'}}>
                    <div style={{background:'var(--color-primary-light)', padding:'8px', borderRadius:'8px'}}>
                        <LogIn size={24} color="var(--color-primary)"/>
                    </div>
                    <h3 style={{margin:0}}>Registrar Acceso</h3>
                </div>
                
                {/* AVISO INTELIGENTE */}
                {(!configDiaHoy) ? (
                     <div style={{...styles.alertBox, background:'#fff3e0', borderColor:'#ffe0b2', color:'#e65100'}}>
                        <HelpCircle size={18}/> 
                        <span>No tienes horario asignado.</span>
                     </div>
                ) : (!configDiaHoy.activo) ? (
                     <div style={{...styles.alertBox, background:'#f5f5f5', borderColor:'#ddd', color:'#666'}}>
                        <Coffee size={18}/> 
                        <span>Hoy es tu día libre.</span>
                     </div>
                ) : (
                     // Si TIENE horario y es activo, checamos retardo
                     <div style={{
                         ...styles.alertBox, 
                         background: estatusTiempo === 'retardo' ? '#fff5f5' : '#e8f5e9', 
                         borderColor: estatusTiempo === 'retardo' ? '#ffcdd2' : '#c8e6c9',
                         color: estatusTiempo === 'retardo' ? '#c62828' : '#2e7d32'
                     }}>
                        {estatusTiempo === 'retardo' ? <AlertTriangle size={18}/> : <Clock size={18}/>}
                        <span>{estatusTiempo === 'retardo' ? 'Tienes Retardo (>20 min)' : 'Estás a tiempo'}</span>
                     </div>
                )}
                
                <form onSubmit={handleCheckIn}>
                    <label style={styles.label}>Responsable en turno</label>
                    <select style={styles.select} value={responsableId} onChange={(e) => setResponsableId(e.target.value)} required>
                        <option value="">-- Selecciona --</option>
                        {responsables.map(r => <option key={r.uid} value={r.uid}>{r.nombre}</option>)}
                    </select>
                    <button type="submit" style={styles.button} disabled={loading || responsables.length===0}>
                        {loading ? 'Conectando...' : '📍 Marcar Entrada'}
                    </button>
                </form>
            </div>
        )}
      </main>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { rotate(0deg); } to { rotate(360deg); } }`}</style>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f4f6f9' },
  centerContainer: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' },
  navbar: { backgroundColor: 'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems:'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  main: { padding: '1.5rem', maxWidth: '500px', margin: '0 auto' },
  
  // STATS CARD (V1 Style)
  statsCard: { backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', marginBottom: '1rem', border:'1px solid white' },
  
  // SCHEDULE CARD (V2 Style compact)
  scheduleCard: { backgroundColor: '#f8f9fa', padding: '1rem 1.5rem', borderRadius: '12px', border:'1px solid #e9ecef', marginBottom: '1.5rem' },
  badge: { fontSize:'0.7rem', padding:'3px 8px', borderRadius:'6px', fontWeight:'bold' },

  // ACTION CARDS
  card: { backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' },
  cardCenter: { backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center' },
  
  // FORM ELEMENTS
  label: { display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color:'#444', fontSize:'0.9rem' },
  select: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', marginBottom: '1.5rem', backgroundColor: '#fff', fontSize:'1rem' },
  button: { width: '100%', padding: '14px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer', fontSize:'1rem', boxShadow:'0 4px 10px rgba(0, 86, 179, 0.2)' },
  btnWarning: { width: '100%', padding: '14px', backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer', fontSize:'1rem', marginTop:'20px' },
  
  // ALERTS
  alertBox: { marginBottom:'1.5rem', padding:'12px', borderRadius:'10px', border:'1px solid', fontSize:'0.9rem', display:'flex', gap:'10px', alignItems:'center' },
  tagRetardo: { color:'#c62828', background:'#ffebee', padding:'5px 10px', borderRadius:'6px', fontSize:'0.8rem', fontWeight:'bold', marginTop:'10px' }
};

export default DashboardPasante;