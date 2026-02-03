// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { logoutUser } from '../services/auth';
import { db } from '../services/firebase';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import {
  LogOut,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Calendar as CalIcon,
  UserPlus,
} from 'lucide-react';

// --- IMPORTAMOS LOS DASHBOARDS ESPECÍFICOS ---
import DashboardPasante from './DashboardPasante';
import DashboardStaff from './DashboardStaff';

// --- UTILIDADES DE FECHA ---
const getNombreCarpeta = (fecha) => {
  const mesNumero = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const mesNombre = fecha.toLocaleString('es-ES', { month: 'long' });
  return `${mesNumero}_${
    mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)
  }`;
};

const getDiasEnMes = (fecha) => {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
};

// ==========================================
// 1. DASHBOARD DE ADMINISTRADOR (COMPLETO)
// ==========================================
const DashboardAdmin = () => {
  const { user } = useUser();

  // VISTAS: 'asistencias' (Calendario) | 'usuarios' (Aprobar nuevos)
  const [vistaAdmin, setVistaAdmin] = useState('asistencias');

  // --- ESTADOS: CALENDARIO ---
  const [fechaActual, setFechaActual] = useState(new Date());
  const [asistenciasMes, setAsistenciasMes] = useState([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date().getDate());

  // --- ESTADOS: APROBACIÓN USUARIOS ---
  const [usuariosPendientes, setUsuariosPendientes] = useState([]);

  // A. CARGAR ASISTENCIAS DEL MES (Calendario)
  useEffect(() => {
    const year = fechaActual.getFullYear().toString();
    const carpetaMes = getNombreCarpeta(fechaActual);

    // Escuchamos la colección: Asistencias > 2026 > 01_Enero
    const coleccionRef = collection(db, 'Asistencias', year, carpetaMes);

    const unsubscribe = onSnapshot(
      coleccionRef,
      (snapshot) => {
        const datos = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          fechaJS: doc.data().fecha ? doc.data().fecha.toDate() : new Date(),
        }));
        setAsistenciasMes(datos);
      },
      () => setAsistenciasMes([])
    ); // Si no existe el mes, limpiar

    return () => unsubscribe();
  }, [fechaActual]);

  // B. CARGAR USUARIOS NUEVOS POR APROBAR
  useEffect(() => {
    const q = query(
      collection(db, 'Usuarios'),
      where('estatus_cuenta', '==', 'por_aprobar')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsuariosPendientes(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    });
    return () => unsubscribe();
  }, []);

  // --- ACCIONES ---
  const cambiarMes = (direccion) => {
    const nuevaFecha = new Date(fechaActual);
    nuevaFecha.setMonth(fechaActual.getMonth() + direccion);
    setFechaActual(nuevaFecha);
    setDiaSeleccionado(1);
  };

  const validarAsistencia = async (id, decision) => {
    const year = fechaActual.getFullYear().toString();
    const carpetaMes = getNombreCarpeta(fechaActual);
    await updateDoc(doc(db, 'Asistencias', year, carpetaMes, id), {
      estatus: decision,
      hora_validacion: serverTimestamp(),
    });
  };

  const aprobarUsuario = async (uid, rol, nombre) => {
    if (!window.confirm(`¿Aceptar a ${nombre} como ${rol.toUpperCase()}?`))
      return;

    try {
      await updateDoc(doc(db, 'Usuarios', uid), {
        estatus_cuenta: 'activo', // ¡Aquí se abre la puerta!
        rol: rol, // Confirmamos el rol solicitado
        registro_completo: true,
      });
      alert('Usuario aprobado y activado.');
    } catch (e) {
      console.error(e);
      alert('Error al aprobar usuario');
    }
  };

  // Filtros para el calendario
  const registrosDelDia = asistenciasMes.filter(
    (a) => a.fechaJS.getDate() === diaSeleccionado
  );
  const diasArray = Array.from(
    { length: getDiasEnMes(fechaActual) },
    (_, i) => i + 1
  );

  return (
    <div style={styles.container}>
      {/* NAVBAR */}
      <nav style={styles.navbar}>
        <div style={styles.brand}>Nexus CEREDI (Admin)</div>

        {/* TABS DE NAVEGACIÓN */}
        <div style={styles.tabsContainer}>
          <button
            onClick={() => setVistaAdmin('asistencias')}
            style={vistaAdmin === 'asistencias' ? styles.tabActive : styles.tab}
          >
            <CalIcon size={18} /> Asistencias
          </button>
          <button
            onClick={() => setVistaAdmin('usuarios')}
            style={vistaAdmin === 'usuarios' ? styles.tabActive : styles.tab}
          >
            <UserPlus size={18} />
            Solicitudes
            {usuariosPendientes.length > 0 && (
              <span style={styles.notificationBadge}>
                {usuariosPendientes.length}
              </span>
            )}
          </button>
        </div>

        <div style={styles.userInfo}>
          <span style={styles.badge}>
            <ShieldCheck size={14} /> ADMIN
          </span>
          <span style={styles.userName}>{user.displayName?.split(' ')[0]}</span>
          <button onClick={logoutUser} style={styles.logoutBtn}>
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main style={styles.main}>
        {/* VISTA 1: APROBACIÓN DE USUARIOS */}
        {vistaAdmin === 'usuarios' && (
          <div>
            <h2 style={{ marginBottom: '1.5rem' }}>
              Usuarios esperando acceso
            </h2>
            {usuariosPendientes.length === 0 ? (
              <div style={styles.emptyState}>
                No hay solicitudes pendientes.
              </div>
            ) : (
              <div style={styles.userGrid}>
                {usuariosPendientes.map((u) => (
                  <div key={u.id} style={styles.userCard}>
                    <div
                      style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        marginBottom: '1rem',
                      }}
                    >
                      <img
                        src={u.foto_url}
                        style={{ width: 50, borderRadius: '50%' }}
                        alt="."
                      />
                      <div>
                        <h4 style={{ margin: 0 }}>{u.nombre}</h4>
                        <p
                          style={{
                            margin: 0,
                            color: '#666',
                            fontSize: '0.9rem',
                          }}
                        >
                          {u.telefono}
                        </p>
                        <span style={styles.rolTag}>
                          Solicita: {u.rol.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => aprobarUsuario(u.id, u.rol, u.nombre)}
                      style={styles.btnApproveFull}
                    >
                      <CheckCircle size={18} /> Aprobar Ingreso
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VISTA 2: CALENDARIO DE ASISTENCIAS */}
        {vistaAdmin === 'asistencias' && (
          <>
            {/* SELECTOR DE MES */}
            <div style={styles.monthSelector}>
              <button onClick={() => cambiarMes(-1)} style={styles.navBtn}>
                <ChevronLeft />
              </button>
              <h2
                style={{
                  margin: 0,
                  width: '250px',
                  textAlign: 'center',
                  textTransform: 'capitalize',
                }}
              >
                {fechaActual.toLocaleString('es-ES', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h2>
              <button onClick={() => cambiarMes(1)} style={styles.navBtn}>
                <ChevronRight />
              </button>
            </div>

            <div style={styles.panelLayout}>
              {/* IZQUIERDA: CALENDARIO */}
              <div style={styles.calendarSection}>
                <div style={styles.calendarGrid}>
                  {diasArray.map((dia) => {
                    const hayPendientes = asistenciasMes.some(
                      (a) =>
                        a.fechaJS.getDate() === dia &&
                        a.estatus === 'pendiente_validacion'
                    );
                    const hayRegistros = asistenciasMes.some(
                      (a) => a.fechaJS.getDate() === dia
                    );

                    return (
                      <div
                        key={dia}
                        onClick={() => setDiaSeleccionado(dia)}
                        style={{
                          ...styles.dayBox,
                          backgroundColor:
                            diaSeleccionado === dia
                              ? 'var(--color-primary)'
                              : 'white',
                          color:
                            diaSeleccionado === dia
                              ? 'white'
                              : 'var(--color-text-main)',
                          borderColor:
                            diaSeleccionado === dia
                              ? 'var(--color-primary)'
                              : '#eee',
                        }}
                      >
                        <span style={{ fontWeight: 'bold' }}>{dia}</span>
                        <div
                          style={{
                            display: 'flex',
                            gap: '2px',
                            marginTop: '4px',
                          }}
                        >
                          {hayPendientes && (
                            <div style={styles.dotWarning}></div>
                          )}
                          {!hayPendientes && hayRegistros && (
                            <div style={styles.dotSuccess}></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={styles.leyenda}>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <div style={styles.dotWarning}></div> Pendientes
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <div style={styles.dotSuccess}></div> Completado
                  </span>
                </div>
              </div>

              {/* DERECHA: DETALLES */}
              <div style={styles.detailSection}>
                <h3
                  style={{
                    margin: '0 0 1rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <CalIcon size={20} /> Día {diaSeleccionado}
                </h3>

                {registrosDelDia.length === 0 ? (
                  <div style={styles.emptyState}>Sin actividad.</div>
                ) : (
                  <div style={styles.listaItems}>
                    {registrosDelDia.map((item) => (
                      <div key={item.id} style={styles.itemRow}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 'bold' }}>
                            {item.nombre_pasante}
                          </p>
                          <p
                            style={{
                              margin: 0,
                              fontSize: '0.75rem',
                              color: '#666',
                            }}
                          >
                            Resp:{' '}
                            {item.nombre_responsable ||
                              item.responsable_seleccionado}
                          </p>
                        </div>

                        {item.estatus === 'pendiente_validacion' ? (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button
                              onClick={() =>
                                validarAsistencia(item.id, 'rechazado')
                              }
                              style={styles.btnActionReject}
                            >
                              <XCircle size={18} />
                            </button>
                            <button
                              onClick={() =>
                                validarAsistencia(item.id, 'aprobado')
                              }
                              style={styles.btnActionApprove}
                            >
                              <CheckCircle size={18} />
                            </button>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor:
                                item.estatus === 'aprobado'
                                  ? '#e6f4ea'
                                  : '#fce8e6',
                              color:
                                item.estatus === 'aprobado'
                                  ? '#1e8e3e'
                                  : '#d93025',
                            }}
                          >
                            {item.estatus.toUpperCase()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

// ==========================================
// 2. COMPONENTE PRINCIPAL (ROUTER DE ROLES)
// ==========================================
const Dashboard = () => {
  const { userData } = useUser();

  if (!userData)
    return <div style={{ padding: '2rem' }}>Cargando perfil...</div>;

  // 1. ADMIN
  if (userData.rol === 'admin') return <DashboardAdmin />;

  // 2. PASANTE
  if (userData.rol === 'pasante') return <DashboardPasante />;

  // 3. STAFF (Profesional o Jefe)
  if (userData.rol === 'profesional' || userData.rol === 'jefe_servicio') {
    return <DashboardStaff />;
  }

  // 4. ERROR
  return <div>Rol no reconocido: {userData.rol}</div>;
};

// ==========================================
// 3. ESTILOS (Consolidados)
// ==========================================
const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f8f9fa' },
  navbar: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  brand: { fontSize: '1.2rem', fontWeight: 'bold' },

  // Tabs Navigation
  tabsContainer: { display: 'flex', gap: '10px' },
  tab: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: '500',
    position: 'relative',
  },
  tabActive: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    background: '#ff4444',
    color: 'white',
    fontSize: '0.7rem',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  userInfo: { display: 'flex', alignItems: 'center', gap: '1rem' },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    opacity: 0.8,
  },
  main: { padding: '2rem', maxWidth: '1100px', margin: '0 auto' },

  // Admin Calendar Views
  monthSelector: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '2rem',
    gap: '1rem',
  },
  navBtn: {
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 2px rgba(0,0,0,0.05)',
  },
  panelLayout: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '2rem',
  },
  calendarSection: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
  },
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '8px',
  },
  dayBox: {
    aspectRatio: '1/1',
    borderRadius: '8px',
    border: '1px solid #eee',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  dotWarning: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-warning)',
  },
  dotSuccess: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-success)',
  },
  leyenda: {
    marginTop: '10px',
    fontSize: '0.8rem',
    color: '#666',
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
  },

  // Details
  detailSection: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    maxHeight: '500px',
    overflowY: 'auto',
  },
  emptyState: {
    textAlign: 'center',
    color: '#999',
    padding: '2rem',
    border: '2px dashed #eee',
    borderRadius: '8px',
  },
  listaItems: { display: 'flex', flexDirection: 'column', gap: '10px' },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    borderBottom: '1px solid #eee',
  },
  btnActionApprove: {
    background: '#e6f4ea',
    border: 'none',
    color: '#1e8e3e',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActionReject: {
    background: '#fce8e6',
    border: 'none',
    color: '#d93025',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Users Approval Views
  userGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1rem',
  },
  userCard: {
    background: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  rolTag: {
    display: 'inline-block',
    background: '#e8f0fe',
    color: 'var(--color-primary)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    marginTop: '5px',
  },
  btnApproveFull: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    background: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    padding: '10px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};

export default Dashboard;
