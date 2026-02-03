import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import { 
  collection, addDoc, doc, onSnapshot, serverTimestamp, 
  getDocs, updateDoc, query, where, getDoc 
} from 'firebase/firestore'; 
import { LogOut, CheckCircle, Loader2, User, Clock, AlertCircle, Award, LogIn } from 'lucide-react';
import { logoutUser } from '../services/auth';

const DashboardPasante = () => {
  const { user, userData } = useUser();
  
  // DATOS
  const [responsables, setResponsables] = useState([]);
  const [responsableId, setResponsableId] = useState('');
  
  // ESTADOS
  const [asistenciaHoy, setAsistenciaHoy] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [misHoras, setMisHoras] = useState(0);

  // 1. CARGAR STAFF (LISTA DE PROFESIONALES)
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

  // 2. ESCUCHAR MIS HORAS
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

  // 3. DETECTAR SESIÓN ACTIVA
  useEffect(() => {
    const hoy = new Date();
    const year = hoy.getFullYear().toString();
    const mesNombre = hoy.toLocaleString('es-ES', { month: 'long' });
    const mesNumero = (hoy.getMonth() + 1).toString().padStart(2, '0');
    const nombreCarpetaMes = `${mesNumero}_${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}`;

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
            const esHoy = fechaDoc && fechaDoc.getDate() === hoy.getDate();

            if (esHoy) {
                if (ultimoRegistro.estatus === 'finalizado' || ultimoRegistro.estatus === 'rechazado') {
                     setAsistenciaHoy(null);
                } else {
                     setAsistenciaHoy(ultimoRegistro);
                }
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

  // ACCIONES
  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!responsableId) return alert("Selecciona un responsable");
    setLoading(true);

    try {
      const responsableObj = responsables.find(r => r.uid === responsableId);
      const hoy = new Date();
      const year = hoy.getFullYear().toString();
      const mesNombre = hoy.toLocaleString('es-ES', { month: 'long' });
      const mesNumero = (hoy.getMonth() + 1).toString().padStart(2, '0');
      const nombreCarpetaMes = `${mesNumero}_${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}`;

      await addDoc(collection(db, "Asistencias", year, nombreCarpetaMes), {
        uid_pasante: user.uid,
        nombre_pasante: user.displayName,
        foto_pasante: user.photoURL,
        servicio: userData.servicio_nombre,
        uid_responsable: responsableId, 
        nombre_responsable: responsableObj.nombre,
        hora_entrada: serverTimestamp(),
        hora_salida: null, 
        tipo: 'turno_variable',
        estatus: 'pendiente_validacion'
      });
    } catch (error) { console.error(error); alert("Error al registrar"); }
    setLoading(false);
  };

  const handleRequestCheckOut = async () => {
    if (!window.confirm("¿Solicitar salida?")) return;
    setLoading(true);
    try {
        const hoy = new Date();
        const year = hoy.getFullYear().toString();
        const mesNombre = hoy.toLocaleString('es-ES', { month: 'long' });
        const mesNumero = (hoy.getMonth() + 1).toString().padStart(2, '0');
        const nombreCarpetaMes = `${mesNumero}_${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}`;
        
        await updateDoc(doc(db, "Asistencias", year, nombreCarpetaMes, asistenciaHoy.id), {
            hora_salida: serverTimestamp(),
            estatus: 'pendiente_salida' 
        });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (cargandoEstado) return <div style={styles.centerContainer}><Loader2 size={48} className="spin" style={{color:'#ccc'}}/></div>;

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={{fontWeight: 'bold', fontSize:'0.9rem', color:'var(--color-primary)'}}>
             Nexus {userData?.servicio_nombre}
        </div>
        <button onClick={logoutUser} style={{border:'none', background:'transparent', cursor:'pointer'}}><LogOut size={18}/></button>
      </nav>

      <main style={styles.main}>
        
        {/* --- TARJETA DE IDENTIDAD DEL PASANTE (NUEVO) --- */}
        <div style={styles.profileHeader}>
            <img src={user.photoURL} style={styles.avatar} alt="."/>
            <div>
                <h2 style={{margin:0, fontSize:'1.1rem'}}>{user.displayName}</h2>
                <div style={styles.badgePasante}>PASANTE</div>
            </div>
            <div style={{marginLeft:'auto', textAlign:'right'}}>
                <div style={{display:'flex', alignItems:'center', gap:'5px', color:'var(--color-primary)', fontWeight:'bold'}}>
                    <Award size={16}/> {misHoras.toFixed(1)}
                </div>
                <div style={{fontSize:'0.7rem', color:'#888'}}>Horas Totales</div>
            </div>
        </div>

        {/* --- LÓGICA DE ESTADOS --- */}
        {asistenciaHoy ? (
             asistenciaHoy.estatus === 'pendiente_validacion' ? (
                <div style={styles.cardCenter}>
                    <Loader2 size={48} className="spin" style={{color:'var(--color-primary)', marginBottom:'1rem'}}/>
                    <h3>Solicitando Entrada...</h3>
                    <p style={{color:'#666'}}>Enviado a: <strong>{asistenciaHoy.nombre_responsable}</strong></p>
                </div>
             ) 
             : asistenciaHoy.estatus === 'pendiente_salida' ? (
                <div style={styles.cardCenter}>
                    <Loader2 size={48} className="spin" style={{color:'#f59e0b', marginBottom:'1rem'}}/>
                    <h3 style={{color:'#d97706'}}>Validando Salida...</h3>
                    <p style={{color:'#666'}}>Tu responsable debe aprobar para sumar las horas.</p>
                </div>
             )
             : asistenciaHoy.estatus === 'aprobado' ? (
                <div style={{...styles.cardCenter, borderTop:'4px solid var(--color-success)'}}>
                    <h2 style={{color:'var(--color-success)'}}>Turno Activo</h2>
                    <p style={{fontSize:'2rem', fontWeight:'bold', margin:'1rem 0'}}>
                        {asistenciaHoy.hora_entrada?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    <p style={{color:'#666', fontSize:'0.9rem', marginBottom:'2rem'}}>Hora de entrada</p>
                    <button onClick={handleRequestCheckOut} style={styles.btnWarning} disabled={loading}>
                        {loading ? 'Procesando...' : '✋ Solicitar Salida'}
                    </button>
                </div>
             ) 
             : <div style={styles.centerContainer}>Cargando...</div>

        ) : (
            // FORMULARIO DE ENTRADA
            <div style={styles.card}>
                <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'1rem'}}>
                    <LogIn size={24} color="var(--color-primary)"/>
                    <h3 style={{margin:0}}>Registrar Acceso</h3>
                </div>
                
                <p style={{fontSize:'0.9rem', color:'#666', marginBottom:'1.5rem'}}>
                    ¿Quién supervisará tu turno hoy?
                </p>
                
                <form onSubmit={handleCheckIn}>
                    <label style={styles.label}>Selecciona Responsable:</label>
                    <select style={styles.select} value={responsableId} onChange={(e) => setResponsableId(e.target.value)} required>
                        <option value="">-- Directorio de Profesionales --</option>
                        {responsables.map(r => <option key={r.uid} value={r.uid}>{r.nombre}</option>)}
                    </select>
                    <button type="submit" style={styles.button} disabled={loading || responsables.length===0}>
                        {loading ? '...' : '📍 Marcar Entrada'}
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
  navbar: { backgroundColor: 'white', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems:'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  main: { padding: '1rem', maxWidth: '500px', margin: '0 auto' },
  
  // PERFIL HEADER
  profileHeader: { display:'flex', alignItems:'center', gap:'10px', backgroundColor:'white', padding:'1rem', borderRadius:'12px', marginBottom:'1.5rem', boxShadow:'0 2px 4px rgba(0,0,0,0.03)' },
  avatar: { width:'50px', height:'50px', borderRadius:'50%', border:'2px solid var(--color-primary)' },
  badgePasante: { background:'#e6f4ea', color:'#1e8e3e', fontSize:'0.7rem', padding:'2px 6px', borderRadius:'4px', display:'inline-block', fontWeight:'bold' },

  card: { backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  cardCenter: { backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center' },
  label: { display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' },
  select: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '1.5rem', backgroundColor: 'white', fontSize:'1rem' },
  button: { width: '100%', padding: '14px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer', fontSize:'1rem' },
  btnWarning: { width: '100%', padding: '14px', backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer', fontSize:'1rem' },
};

export default DashboardPasante;