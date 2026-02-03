import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import { collection, addDoc, doc, onSnapshot, serverTimestamp, getDocs } from 'firebase/firestore'; 
import { LogOut, CheckCircle, Loader2, User } from 'lucide-react';
import { logoutUser } from '../services/auth';

const DashboardPasante = () => {
  const { user, userData } = useUser(); // userData tiene 'servicio_id' y 'servicio_nombre'
  const [responsables, setResponsables] = useState([]);
  const [responsableId, setResponsableId] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [solicitudActiva, setSolicitudActiva] = useState(null); 
  const [datosEnVivo, setDatosEnVivo] = useState(null);

  // 1. CARGAR STAFF DE MI SERVICIO ESPECÍFICO
  useEffect(() => {
    const cargarStaff = async () => {
      if (!userData?.servicio_id) return;

      try {
        // Ruta: /psicologia/Data/Profesionales
        // Esta ruta debe coincidir EXACTAMENTE con donde guardamos en RegistroData
        const rutaColeccion = collection(db, userData.servicio_id, "Data", "Profesionales");
        
        const snapshot = await getDocs(rutaColeccion);
        const lista = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        
        setResponsables(lista);
      } catch (error) {
        console.error("Error cargando staff de " + userData.servicio_nombre, error);
      }
    };
    cargarStaff();
  }, [userData]);

  // 2. ESCUCHAR CAMBIOS (Igual que antes)
  useEffect(() => {
    if (!solicitudActiva) return;
    const docRef = doc(db, "Asistencias", solicitudActiva.year, solicitudActiva.mes, solicitudActiva.id);
    const unsubscribe = onSnapshot(docRef, (snap) => { if (snap.exists()) setDatosEnVivo(snap.data()); });
    return () => unsubscribe();
  }, [solicitudActiva]);

  // 3. CHECK-IN
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

      // Guardamos la asistencia en la bitácora global (para el calendario del admin)
      // Y opcionalmente podrías guardarla también en la carpeta del servicio si quisieras
      const coleccionDestino = collection(db, "Asistencias", year, nombreCarpetaMes);

      const docRef = await addDoc(coleccionDestino, {
        uid_pasante: user.uid,
        nombre_pasante: user.displayName,
        foto_pasante: user.photoURL,
        servicio: userData.servicio_nombre, // Guardamos de qué servicio viene
        uid_responsable: responsableId, 
        nombre_responsable: responsableObj.nombre,
        fecha: serverTimestamp(),
        tipo: 'entrada',
        estatus: 'pendiente_validacion'
      });

      setSolicitudActiva({ id: docRef.id, year: year, mes: nombreCarpetaMes });
    } catch (error) { console.error(error); alert("Error al registrar"); }
    setLoading(false);
  };

  if (datosEnVivo?.estatus === 'aprobado') {
    return (
      <div style={styles.centerContainer}>
         <CheckCircle size={64} color="var(--color-success)" />
         <h1 style={{color:'var(--color-success)'}}>Entrada Registrada</h1>
         <p>Validado por: {datosEnVivo.nombre_responsable}</p>
         <button onClick={logoutUser} style={styles.btnSmall}>Salir</button>
      </div>
    );
  }

  if (solicitudActiva) {
    return <div style={styles.centerContainer}><Loader2 size={48} className="spin"/><h3>Esperando validación...</h3></div>;
  }

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <span style={{fontWeight: 'bold'}}>Nexus {userData?.servicio_nombre}</span>
        <button onClick={logoutUser} style={{border:'none', background:'transparent'}}><LogOut size={18}/></button>
      </nav>
      <main style={styles.main}>
        <div style={styles.card}>
            <h3>Registrar Entrada</h3>
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
              <button type="submit" style={styles.button} disabled={loading}>
                {loading ? '...' : 'Solicitar Acceso'}
              </button>
            </form>
        </div>
      </main>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { rotate(0deg); } to { rotate(360deg); } }`}</style>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f4f6f9' },
  centerContainer: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', textAlign:'center', padding:'2rem' },
  navbar: { backgroundColor: 'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  main: { padding: '2rem', maxWidth: '500px', margin: '0 auto' },
  card: { backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  label: { display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' },
  select: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '1.5rem', backgroundColor: 'white' },
  button: { width: '100%', padding: '14px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer' },
  btnSmall: { padding:'8px 16px', borderRadius:'8px', border:'1px solid #ddd', background:'white' }
};

export default DashboardPasante;