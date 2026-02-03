// src/pages/DashboardStaff.jsx
import React, { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { db } from '../services/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
  getDocs,
} from 'firebase/firestore';
import { LogOut, UserCheck, AlertTriangle, FileText } from 'lucide-react';
import { logoutUser } from '../services/auth';

// --- UTILIDAD DE FECHA ---
const getNombreCarpeta = (fecha) => {
  const mesNumero = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const mesNombre = fecha.toLocaleString('es-ES', { month: 'long' });
  return `${mesNumero}_${
    mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)
  }`;
};

const DashboardStaff = () => {
  const { user, userData } = useUser();
  const [solicitudes, setSolicitudes] = useState([]);
  const [vista, setVista] = useState('entradas'); // 'entradas' o 'reportes'

  // Estados para reporte
  const [pasantes, setPasantes] = useState([]);
  const [reporteForm, setReporteForm] = useState({
    uid_pasante: '',
    gravedad: 'leve',
    descripcion: '',
  });

  // 1. ESCUCHAR MIS SOLICITUDES (Filtradas por MI ID)
  useEffect(() => {
    const hoy = new Date();
    const year = hoy.getFullYear().toString();
    const carpetaMes = getNombreCarpeta(hoy);

    // Consulta: Asistencias de este mes DONDE responsable soy YO
    const q = query(
      collection(db, 'Asistencias', year, carpetaMes),
      where('uid_responsable', '==', user.uid),
      where('estatus', '==', 'pendiente_validacion')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSolicitudes(
        snapshot.docs.map((d) => ({
          id: d.id,
          path_year: year,
          path_mes: carpetaMes,
          ...d.data(),
        })),
        (error) => {
          // Si la carpeta del mes no existe aún, no pasa nada, lista vacía
          setSolicitudes([]);
        }
      );
    });
    return () => unsubscribe();
  }, [user.uid]);

  // 2. VALIDAR ENTRADA
  const validar = async (item, decision) => {
    try {
      await updateDoc(
        doc(db, 'Asistencias', item.path_year, item.path_mes, item.id),
        {
          estatus: decision,
          hora_validacion: serverTimestamp(),
        }
      );
    } catch (e) {
      alert('Error al validar');
    }
  };

  // 3. CARGAR PASANTES (Solo si soy Jefe y voy a reportar)
  useEffect(() => {
    if (
      userData.rol === 'jefe_servicio' &&
      vista === 'reportes' &&
      pasantes.length === 0
    ) {
      const cargar = async () => {
        const q = query(
          collection(db, 'Usuarios'),
          where('rol', '==', 'pasante')
        );
        const snap = await getDocs(q);
        setPasantes(
          snap.docs.map((d) => ({ uid: d.id, nombre: d.data().nombre }))
        );
      };
      cargar();
    }
  }, [userData.rol, vista]);

  // 4. CREAR REPORTE
  const enviarReporte = async (e) => {
    e.preventDefault();
    if (!reporteForm.uid_pasante) return alert('Selecciona pasante');

    const pasanteNombre = pasantes.find(
      (p) => p.uid === reporteForm.uid_pasante
    )?.nombre;

    await addDoc(collection(db, 'Reportes'), {
      ...reporteForm,
      nombre_pasante: pasanteNombre,
      uid_jefe: user.uid,
      nombre_jefe: user.displayName,
      fecha: serverTimestamp(),
      estatus: 'activo',
    });
    alert('Reporte creado correctamente');
    setReporteForm({ uid_pasante: '', gravedad: 'leve', descripcion: '' });
  };

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={{ fontWeight: 'bold' }}>
          {userData.rol === 'jefe_servicio'
            ? 'Jefatura de Servicio'
            : 'Panel Profesional'}
        </div>
        <button
          onClick={logoutUser}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <LogOut size={18} />
        </button>
      </nav>

      {/* TABS PARA EL JEFE */}
      {userData.rol === 'jefe_servicio' && (
        <div style={styles.tabs}>
          <button
            style={vista === 'entradas' ? styles.tabActive : styles.tab}
            onClick={() => setVista('entradas')}
          >
            <UserCheck size={16} /> Validar Entradas
          </button>
          <button
            style={vista === 'reportes' ? styles.tabActive : styles.tab}
            onClick={() => setVista('reportes')}
          >
            <AlertTriangle size={16} /> Crear Reporte
          </button>
        </div>
      )}

      <main style={styles.main}>
        {/* VISTA 1: VALIDACIÓN DE ENTRADAS */}
        {vista === 'entradas' && (
          <div>
            <h2 style={{ marginBottom: '1rem' }}>
              Solicitudes para mí ({solicitudes.length})
            </h2>
            {solicitudes.length === 0 && (
              <div style={styles.emptyState}>
                No tienes nadie esperando tu aprobación.
              </div>
            )}

            <div style={styles.grid}>
              {solicitudes.map((soli) => (
                <div key={soli.id} style={styles.card}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      marginBottom: '1rem',
                    }}
                  >
                    <img
                      src={soli.foto_pasante}
                      style={{ width: 40, borderRadius: '50%' }}
                      alt="."
                    />
                    <div>
                      <div style={{ fontWeight: 'bold' }}>
                        {soli.nombre_pasante}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>
                        Solicita acceso
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => validar(soli, 'rechazado')}
                      style={styles.btnReject}
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => validar(soli, 'aprobado')}
                      style={styles.btnApprove}
                    >
                      Aceptar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 2: REPORTES (Solo Jefe) */}
        {vista === 'reportes' && userData.rol === 'jefe_servicio' && (
          <div style={styles.card}>
            <h3>
              <FileText size={20} style={{ verticalAlign: 'middle' }} /> Nuevo
              Reporte de Conducta
            </h3>
            <form
              onSubmit={enviarReporte}
              style={{
                marginTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div>
                <label style={styles.label}>Pasante implicado</label>
                <select
                  style={styles.input}
                  value={reporteForm.uid_pasante}
                  onChange={(e) =>
                    setReporteForm({
                      ...reporteForm,
                      uid_pasante: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Seleccionar...</option>
                  {pasantes.map((p) => (
                    <option key={p.uid} value={p.uid}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={styles.label}>Tipo de Falta</label>
                <select
                  style={styles.input}
                  value={reporteForm.gravedad}
                  onChange={(e) =>
                    setReporteForm({ ...reporteForm, gravedad: e.target.value })
                  }
                >
                  <option value="leve">Leve (Llamada de atención)</option>
                  <option value="moderada">Moderada (Incumplimiento)</option>
                  <option value="grave">Grave (Conducta Inapropiada)</option>
                </select>
              </div>
              <div>
                <label style={styles.label}>Descripción de los hechos</label>
                <textarea
                  style={{ ...styles.input, height: '100px' }}
                  value={reporteForm.descripcion}
                  onChange={(e) =>
                    setReporteForm({
                      ...reporteForm,
                      descripcion: e.target.value,
                    })
                  }
                  required
                  placeholder="Describa qué sucedió..."
                />
              </div>
              <button type="submit" style={styles.btnApprove}>
                Guardar Reporte
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f8f9fa' },
  navbar: {
    backgroundColor: 'white',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    borderBottom: '1px solid #ddd',
  },
  main: { padding: '2rem', maxWidth: '800px', margin: '0 auto' },
  tabs: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    padding: '1rem',
  },
  tab: {
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    display: 'flex',
    gap: '5px',
    alignItems: 'center',
    opacity: 0.6,
  },
  tabActive: {
    padding: '8px 16px',
    border: 'none',
    background: 'white',
    borderRadius: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    display: 'flex',
    gap: '5px',
    alignItems: 'center',
    fontWeight: 'bold',
    color: 'var(--color-primary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '1rem',
  },
  card: {
    background: 'white',
    padding: '1rem',
    borderRadius: '12px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
  },
  emptyState: {
    textAlign: 'center',
    color: '#999',
    padding: '2rem',
    border: '2px dashed #eee',
    borderRadius: '8px',
  },
  btnApprove: {
    flex: 1,
    padding: '8px',
    border: 'none',
    borderRadius: '6px',
    background: 'var(--color-primary)',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  btnReject: {
    flex: 1,
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    background: 'white',
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ddd',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
    marginBottom: '5px',
    display: 'block',
  },
};

export default DashboardStaff;
