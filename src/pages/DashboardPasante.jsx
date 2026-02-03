import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import { 
  collection, addDoc, doc, onSnapshot, serverTimestamp, 
  getDocs, updateDoc, query, where, increment, getDoc 
} from 'firebase/firestore'; 
import { LogOut, CheckCircle, Loader2, User, Clock, AlertCircle, Award } from 'lucide-react';
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
  
  // NUEVO: ESTADO PARA MOSTRAR HORAS ACUMULADAS
  const [misHoras, setMisHoras] = useState(0);

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

  // 2. ESCUCHAR MIS HORAS ACUMULADAS (NUEVO)
  useEffect(() => {
    if (!userData?.servicio_id) return;
    
    // Escuchamos el perfil del pasante en su carpeta de servicio
    const docRef = doc(db, userData.servicio_id, "Data", "Pasantes", user.uid);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            // Si existe el campo, lo usamos. Si no, es 0.
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
            
            // Orden manual por fecha (más reciente primero)
            registros.sort((a, b) => {
                const fechaA = a.hora_entrada?.seconds || 0;
                const fechaB = b.hora_entrada?.seconds || 0;
                return fechaB - fechaA;
            });

            const ultimoRegistro = registros[0];
            const fechaDoc = ultimoRegistro.hora_entrada?.toDate();
            const esHoy = fechaDoc && fechaDoc.getDate() === hoy.getDate();

            setAsistenciaHoy(esHoy ? ultimoRegistro : null);
        } else {
            setAsistenciaHoy(null);
        }
        setCargandoEstado(false);
    }, () => setCargandoEstado(false));

    return () => unsubscribe();
  }, [user.uid]);

  // --- ACCIÓN: REGISTRAR ENTRADA ---
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
        
        tipo: 'turno_completo',
        estatus: 'pendiente_validacion'
      });
    } catch (error) { console.error(error); alert("Error al registrar"); }
    setLoading(false);
  };

  // --- ACCIÓN: REGISTRAR SALIDA Y SUMAR TIEMPO ---
  const handleCheckOut = async () => {
    if (!window.confirm("¿Seguro que deseas cerrar tu turno por hoy?")) return;
    setLoading(true);
    
    try {
        const ahora = new Date();
        const fechaEntrada = asistenciaHoy.hora_entrada.toDate(); // Convertimos Timestamp a Date JS
        
        // 1. Calculamos diferencia en milisegundos
        const diferenciaMs = ahora - fechaEntrada;
        
        // 2. Convertimos a HORAS (con decimales)
        // ms -> segundos (/1000) -> minutos (/60) -> horas (/60)
        const horasTrabajadas = diferenciaMs / (1000 * 60 * 60);
        
        // Redondeamos a 2 decimales para que no sea un número infinito
        const horasRedondeadas = Math.round(horasTrabajadas * 100) / 100;

        // Datos para actualizar la asistencia
        const hoy = new Date();
        const year = hoy.getFullYear().toString();
        const mesNombre = hoy.toLocaleString('es-ES', { month: 'long' });
        const mesNumero = (hoy.getMonth() + 1).toString().padStart(2, '0');
        const nombreCarpetaMes = `${mesNumero}_${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}`;

        // A. Cerramos la asistencia
        const asistenciaRef = doc(db, "Asistencias", year, nombreCarpetaMes, asistenciaHoy.id);
        await updateDoc(asistenciaRef, {
            hora_salida: serverTimestamp(),
            estatus: 'finalizado',
            horas_sesion: horasRedondeadas // Guardamos cuánto duró esta sesión específica
        });

        // B. Sumamos al acumulado del Pasante (En su carpeta de Servicio)
        if (userData.servicio_id) {
            const perfilRef = doc(db, userData.servicio_id, "Data", "Pasantes", user.uid);
            await updateDoc(perfilRef, {
                horas_acumuladas: increment(horasRedondeadas), // Función mágica de suma
                ultima_asistencia: serverTimestamp()
            });
        }

    } catch (error) {
        console.error(error);
        alert("Error al registrar salida");
    }
    setLoading(false);
  };

  // --- RENDERIZADO ---

  if (cargandoEstado) return <div style={styles.centerContainer}><Loader2 size={48} className="spin" style={{color:'#ccc'}}/></div>;

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={{display:'flex', flexDirection:'column'}}>
             <span style={{fontWeight: 'bold', fontSize:'0.9rem'}}>Nexus {userData?.servicio_nombre}</span>
             {/* INDICADOR DE HORAS EN NAVBAR */}
             <span style={{fontSize:'0.75rem', color:'#666', display:'flex', alignItems:'center', gap:'4px'}}>
                <Award size={12} color="var(--color-primary)"/> {misHoras.toFixed(1)} hrs acumuladas
             </span>
        </div>
        <button onClick={logoutUser} style={{border:'none', background:'transparent', cursor:'pointer'}}><LogOut size={18}/></button>
      </nav>

      <main style={styles.main}>
        {/* TARJETA DE RESUMEN DE HORAS */}
        <div style={styles.statsCard}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                    <p style={{margin:0, fontSize:'0.8rem', color:'#888', fontWeight:'bold'}}>TOTAL ACUMULADO</p>
                    <h2 style={{margin:0, color:'var(--color-primary)', fontSize:'1.8rem'}}>{misHoras.toFixed(2)} <span style={{fontSize:'1rem'}}>hrs</span></h2>
                </div>
                <div style={{background:'#e8f0fe', padding:'10px', borderRadius:'50%'}}>
                    <Clock size={24} color="var(--color-primary)"/>
                </div>
            </div>
        </div>

        {/* LOGICA DE ESTADOS (Igual que antes, solo inyectada aquí) */}
        {asistenciaHoy ? (
             asistenciaHoy.estatus === 'rechazado' ? (
                <div style={styles.cardCenter}>
                    <AlertCircle size={48} color="var(--color-danger)" style={{marginBottom:'1rem'}}/>
                    <h3 style={{color:'var(--color-danger)'}}>Entrada Rechazada</h3>
                    <p>Intenta registrarte de nuevo.</p>
                    <button onClick={() => setAsistenciaHoy(null)} style={styles.btnSmall}>Ok</button>
                </div>
             ) : asistenciaHoy.hora_salida ? (
                <div style={styles.cardCenter}>
                    <CheckCircle size={48} color="#888" style={{marginBottom:'1rem'}}/>
                    <h3>Jornada Finalizada</h3>
                    <p>Entrada: {asistenciaHoy.hora_entrada?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                    <p>Salida: {asistenciaHoy.hora_salida?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                </div>
             ) : asistenciaHoy.estatus === 'pendiente_validacion' ? (
                <div style={styles.cardCenter}>
                    <Loader2 size={48} className="spin" style={{color:'var(--color-primary)', marginBottom:'1rem'}}/>
                    <h3>Esperando a tu responsable...</h3>
                    <p>Solicitud enviada a: <strong>{asistenciaHoy.nombre_responsable}</strong></p>
                </div>
             ) : (
                <div style={{...styles.cardCenter, borderTop:'4px solid var(--color-success)'}}>
                    <h2 style={{color:'var(--color-success)'}}>Turno Activo</h2>
                    <p style={{fontSize:'2rem', fontWeight:'bold', margin:'1rem 0'}}>
                        {asistenciaHoy.hora_entrada?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    <p style={{color:'#666', fontSize:'0.9rem', marginBottom:'2rem'}}>Hora de entrada</p>
                    <button onClick={handleCheckOut} style={styles.btnDanger} disabled={loading}>
                        {loading ? 'Cerrando...' : 'Registrar Salida'}
                    </button>
                </div>
             )
        ) : (
            <div style={styles.card}>
                <h3>Iniciar Turno</h3>
                <form onSubmit={handleCheckIn} style={{marginTop:'1rem'}}>
                    <label style={styles.label}>Responsable</label>
                    <select style={styles.select} value={responsableId} onChange={(e) => setResponsableId(e.target.value)} required>
                        <option value="">-- Selecciona --</option>
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
  
  // Stats Card
  statsCard: { backgroundColor: 'white', padding: '1rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', marginBottom: '1.5rem' },
  
  card: { backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  cardCenter: { backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center' },
  
  label: { display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' },
  select: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '1.5rem', backgroundColor: 'white', fontSize:'1rem' },
  button: { width: '100%', padding: '14px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer', fontSize:'1rem' },
  btnDanger: { width: '100%', padding: '14px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer', fontSize:'1rem' },
  btnSmall: { padding:'8px 16px', borderRadius:'8px', border:'1px solid #ddd', background:'white', cursor:'pointer' }
};

export default DashboardPasante;