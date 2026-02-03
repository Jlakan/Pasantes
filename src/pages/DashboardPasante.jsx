import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import { collection, addDoc, doc, onSnapshot, serverTimestamp, getDocs, updateDoc, query, where, orderBy, limit } from 'firebase/firestore'; 
import { LogOut, CheckCircle, Loader2, User, Clock, AlertCircle } from 'lucide-react';
import { logoutUser } from '../services/auth';

const DashboardPasante = () => {
  const { user, userData } = useUser();
  
  // DATOS
  const [responsables, setResponsables] = useState([]);
  const [responsableId, setResponsableId] = useState('');
  
  // ESTADO DE LA ASISTENCIA DE HOY
  const [asistenciaHoy, setAsistenciaHoy] = useState(null); // Aquí guardamos el objeto completo de la BD
  const [loading, setLoading] = useState(false);
  const [cargandoEstado, setCargandoEstado] = useState(true); // Para el spinner inicial

  // 1. CARGAR STAFF (Igual que antes)
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

  // 2. DETECTAR SESIÓN ACTIVA (EL CAMBIO CLAVE)
  // Al entrar, buscamos si ya existe un documento para HOY
  useEffect(() => {
    const hoy = new Date();
    const year = hoy.getFullYear().toString();
    const mesNombre = hoy.toLocaleString('es-ES', { month: 'long' });
    const mesNumero = (hoy.getMonth() + 1).toString().padStart(2, '0');
    const nombreCarpetaMes = `${mesNumero}_${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}`;

    // Buscamos en la colección de este mes
    const q = query(
        collection(db, "Asistencias", year, nombreCarpetaMes),
        where("uid_pasante", "==", user.uid),
        orderBy("hora_entrada", "desc"), // Traemos la última
        limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const docData = snapshot.docs[0];
            const datos = { id: docData.id, ...docData.data() };
            
            // Verificamos que sea DE HOY (por si la colección tiene varios días)
            const fechaDoc = datos.hora_entrada?.toDate();
            const esHoy = fechaDoc && fechaDoc.getDate() === hoy.getDate();

            if (esHoy) {
                setAsistenciaHoy(datos); // ¡Recuperamos la sesión!
            } else {
                setAsistenciaHoy(null);
            }
        } else {
            setAsistenciaHoy(null);
        }
        setCargandoEstado(false);
    });

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
        
        // USAMOS HORA_ENTRADA Y HORA_SALIDA
        hora_entrada: serverTimestamp(),
        hora_salida: null, // <--- Importante: Empieza vacía
        
        tipo: 'turno_completo', // Etiqueta general
        estatus: 'pendiente_validacion'
      });
      // No necesitamos setSolicitudActiva manual, el onSnapshot de arriba lo detectará solito ;)

    } catch (error) { console.error(error); alert("Error al registrar"); }
    setLoading(false);
  };

  // --- ACCIÓN: REGISTRAR SALIDA ---
  const handleCheckOut = async () => {
    if (!window.confirm("¿Seguro que deseas cerrar tu turno por hoy?")) return;
    setLoading(true);
    
    try {
        const hoy = new Date();
        const year = hoy.getFullYear().toString();
        const mesNombre = hoy.toLocaleString('es-ES', { month: 'long' });
        const mesNumero = (hoy.getMonth() + 1).toString().padStart(2, '0');
        const nombreCarpetaMes = `${mesNumero}_${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}`;

        // Actualizamos el documento existente
        const docRef = doc(db, "Asistencias", year, nombreCarpetaMes, asistenciaHoy.id);
        
        await updateDoc(docRef, {
            hora_salida: serverTimestamp(),
            estatus: 'finalizado' // Opcional: cambiamos estatus a finalizado
        });

    } catch (error) {
        console.error(error);
        alert("Error al registrar salida");
    }
    setLoading(false);
  };

  // --- RENDERIZADO ---

  if (cargandoEstado) {
      return <div style={styles.centerContainer}><Loader2 size={48} className="spin" style={{color:'#999'}}/></div>;
  }

  // CASO 1: YA EXISTE UN REGISTRO DE HOY
  if (asistenciaHoy) {
    
    // 1.1: Si fue RECHAZADO, permitimos intentar de nuevo
    if (asistenciaHoy.estatus === 'rechazado') {
        return (
            <div style={styles.centerContainer}>
                <AlertCircle size={64} color="var(--color-danger)"/>
                <h2 style={{color:'var(--color-danger)'}}>Entrada Rechazada</h2>
                <p>El responsable no validó tu asistencia.</p>
                <button onClick={() => setAsistenciaHoy(null)} style={styles.btnSmall}>Intentar de nuevo</button>
            </div>
        );
    }

    // 1.2: Si ya tiene HORA DE SALIDA (Turno terminado)
    if (asistenciaHoy.hora_salida) {
        return (
            <div style={styles.centerContainer}>
                <CheckCircle size={64} color="#888" />
                <h2 style={{color:'#666'}}>Jornada Finalizada</h2>
                <div style={styles.resumenCard}>
                    <p><strong>Entrada:</strong> {asistenciaHoy.hora_entrada?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    <p><strong>Salida:</strong> {asistenciaHoy.hora_salida?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    <p style={{color:'green', marginTop:'10px'}}>¡Hasta mañana!</p>
                </div>
                <button onClick={logoutUser} style={styles.btnSmall}>Cerrar Sesión</button>
            </div>
        );
    }

    // 1.3: Si está PENDIENTE de validación
    if (asistenciaHoy.estatus === 'pendiente_validacion') {
        return (
            <div style={styles.centerContainer}>
                <Loader2 size={48} className="spin" style={{color:'var(--color-primary)'}}/>
                <h3>Esperando validación...</h3>
                <p style={{color:'#666'}}>Solicitud enviada a: <strong>{asistenciaHoy.nombre_responsable}</strong></p>
                <div style={{fontSize:'0.8rem', background:'#e8f0fe', padding:'10px', borderRadius:'8px', marginTop:'1rem'}}>
                    <Clock size={14} style={{verticalAlign:'middle'}}/> Hora registro: {asistenciaHoy.hora_entrada?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
            </div>
        );
    }

    // 1.4: Si está APROBADO y NO TIENE SALIDA (Sesión Activa)
    if (asistenciaHoy.estatus === 'aprobado') {
        return (
            <div style={styles.container}>
                <nav style={styles.navbar}>
                    <span style={{fontWeight: 'bold'}}>Sesión Activa</span>
                    <button onClick={logoutUser} style={{border:'none', background:'transparent'}}><LogOut size={18}/></button>
                </nav>
                <main style={{...styles.main, textAlign:'center'}}>
                    <div style={{...styles.card, borderTop:'5px solid var(--color-success)'}}>
                        <div style={{marginBottom:'1rem'}}><CheckCircle size={48} color="var(--color-success)"/></div>
                        <h2 style={{color:'var(--color-success)', margin:0}}>Turno en Curso</h2>
                        <p style={{color:'#666'}}>Validado por: {asistenciaHoy.nombre_responsable}</p>
                        
                        <div style={{background:'#f8f9fa', padding:'1.5rem', borderRadius:'12px', margin:'2rem 0'}}>
                            <p style={{fontSize:'0.9rem', color:'#888', margin:0}}>HORA DE ENTRADA</p>
                            <p style={{fontSize:'2rem', fontWeight:'bold', margin:'0.5rem 0'}}>
                                {asistenciaHoy.hora_entrada?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </p>
                        </div>

                        <button onClick={handleCheckOut} style={styles.btnDanger} disabled={loading}>
                            {loading ? 'Cerrando...' : '🔴 Registrar Salida'}
                        </button>
                    </div>
                </main>
            </div>
        );
    }
  }

  // CASO 2: NO HAY REGISTRO HOY -> MOSTRAR FORMULARIO
  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <span style={{fontWeight: 'bold'}}>Nexus {userData?.servicio_nombre}</span>
        <button onClick={logoutUser} style={{border:'none', background:'transparent'}}><LogOut size={18}/></button>
      </nav>
      <main style={styles.main}>
        <div style={styles.card}>
            <h3>Iniciar Turno</h3>
            <p style={{fontSize:'0.9rem', color:'#666', marginBottom:'1.5rem'}}>
                Servicio: <strong>{userData?.servicio_nombre}</strong>
            </p>
            
            <form onSubmit={handleCheckIn}>
              <label style={styles.label}>Responsable</label>
              <select style={styles.select} value={responsableId} onChange={(e) => setResponsableId(e.target.value)} required>
                <option value="">-- Selecciona --</option>
                {responsables.map((resp) => (
                  <option key={resp.uid} value={resp.uid}>{resp.nombre}</option>
                ))}
              </select>
              <button type="submit" style={styles.button} disabled={loading || responsables.length === 0}>
                {loading ? '...' : '📍 Marcar Entrada'}
              </button>
            </form>
        </div>
      </main>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { rotate(0deg); } to { rotate(360deg); } }`}</style>
    </div>
  );
};

// ESTILOS
const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f4f6f9' },
  centerContainer: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', textAlign:'center', padding:'2rem' },
  navbar: { backgroundColor: 'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  main: { padding: '2rem', maxWidth: '500px', margin: '0 auto' },
  card: { backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  resumenCard: { backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign:'left', width:'100%', maxWidth:'300px' },
  label: { display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' },
  select: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '1.5rem', backgroundColor: 'white', fontSize:'1rem' },
  button: { width: '100%', padding: '14px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer', fontSize:'1rem' },
  btnDanger: { width: '100%', padding: '14px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer', fontSize:'1rem' },
  btnSmall: { padding:'10px 20px', borderRadius:'8px', border:'1px solid #ddd', background:'white', cursor:'pointer' }
};

export default DashboardPasante;