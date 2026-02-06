import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { 
  collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDocs 
} from 'firebase/firestore'; 
import { logoutUser } from '../services/auth';
import { 
  LogOut, Shield, Briefcase, Settings, Save, X, RefreshCw, Users,
  Clock, PlusCircle, Calendar, Search, ToggleLeft, ToggleRight, 
  CheckSquare, Square, ArrowDownCircle
} from 'lucide-react';

import HistorialGlobal from '../components/HistorialGlobal'; 
import DirectorioUsuarios from '../components/DirectorioUsuarios';
import AdminServicios from '../components/AdminServicios'; 
import AuditoriaAsistencia from '../components/AuditoriaAsistencia';

const DashboardAdmin = ({ esDobleRol, cambiarVista }) => {
  // --- ESTADOS GENERALES ---
  const [usuariosPendientes, setUsuariosPendientes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usuarioAEditar, setUsuarioAEditar] = useState(null);
  
  // --- ESTADO MODAL SERVICIOS (RECUPERADO) ---
  const [mostrarAdminServicios, setMostrarAdminServicios] = useState(false);
  
  // --- ESTADOS GESTOR HORARIOS ---
  const [mostrarGestorHorarios, setMostrarGestorHorarios] = useState(false);
  const [listaPasantes, setListaPasantes] = useState([]);
  const [busquedaPasante, setBusquedaPasante] = useState('');
  const [pasanteSeleccionado, setPasanteSeleccionado] = useState(null);

  // ESTRUCTURA: DICCIONARIO POR DÍA
  const diasBase = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  
  // Estado del horario detallado (Objeto final a guardar)
  const [horarioSemanal, setHorarioSemanal] = useState({});

  // --- ESTADOS PARA EDICIÓN MASIVA (AGILIDAD V1) ---
  const [batchEntrada, setBatchEntrada] = useState('08:00');
  const [batchSalida, setBatchSalida] = useState('14:00');
  const [batchDias, setBatchDias] = useState(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);

  // ESTADO ASIGNACIÓN INICIAL
  const [seleccion, setSeleccion] = useState({ servicio_id: '', rol_asignar: 'pasante' });

  // 1. CARGAS INICIALES
  useEffect(() => {
    const q = query(collection(db, "Usuarios"), where("estatus_cuenta", "==", "pendiente_asignacion"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsuariosPendientes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "CatalogoServicios"));
    const unsubscribe = onSnapshot(q, (snap) => {
        setServicios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe;
  }, []);

  useEffect(() => {
    if (mostrarGestorHorarios) {
        const q = query(collection(db, "Usuarios"), where("rol", "==", "pasante"));
        const unsubscribe = onSnapshot(q, (snap) => {
            setListaPasantes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubscribe();
    }
  }, [mostrarGestorHorarios]);

  // --- LÓGICA HORARIOS: MEZCLA V1 + V2 ---

  const inicializarHorario = (usuario) => {
      const horarioExistente = usuario.horario || {};
      const nuevoEstado = {};
      
      diasBase.forEach(dia => {
          if (horarioExistente[dia]) {
              nuevoEstado[dia] = horarioExistente[dia];
          } else {
              nuevoEstado[dia] = { activo: false, entrada: '08:00', salida: '14:00' };
          }
      });
      setHorarioSemanal(nuevoEstado);
      setPasanteSeleccionado(usuario);
      // Resetear herramienta masiva a default
      setBatchDias(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
  };

  // Función V1: Toggle de días para la herramienta masiva
  const toggleBatchDia = (dia) => {
      if (batchDias.includes(dia)) {
          setBatchDias(batchDias.filter(d => d !== dia));
      } else {
          setBatchDias([...batchDias, dia]);
      }
  };

  // Función V1 -> V2: Aplicar masivo a la lista detallada
  const aplicarMasivo = () => {
      const nuevoHorario = { ...horarioSemanal };
      batchDias.forEach(dia => {
          nuevoHorario[dia] = {
              activo: true,
              entrada: batchEntrada,
              salida: batchSalida
          };
      });
      setHorarioSemanal(nuevoHorario);
  };

  // Función V2: Ajuste fino individual
  const actualizarDiaIndividual = (dia, campo, valor) => {
      setHorarioSemanal(prev => ({
          ...prev,
          [dia]: { ...prev[dia], [campo]: valor }
      }));
  };

  const guardarHorarioSemanal = async () => {
      if (!pasanteSeleccionado) return;
      setLoading(true);
      try {
          const uid = pasanteSeleccionado.id;
          const servicioId = pasanteSeleccionado.servicio_id;
          
          await updateDoc(doc(db, "Usuarios", uid), { horario: horarioSemanal });

          if (servicioId) {
              await updateDoc(doc(db, servicioId, "Data", "Pasantes", uid), { horario: horarioSemanal });
          }

          alert(`Horario actualizado para ${pasanteSeleccionado.nombre}`);
          setPasanteSeleccionado(null);
      } catch (e) { console.error(e); alert("Error guardando horario."); }
      setLoading(false);
  };

  // --- LÓGICA ASIGNACIÓN INICIAL ---
  const handleAsignarInicial = async () => {
    if (!seleccion.servicio_id) return alert("Selecciona servicio.");
    setLoading(true);
    try {
      const servicioObj = servicios.find(s => s.id === seleccion.servicio_id);
      const uid = usuarioAEditar.id;
      
      const datosBase = {
        isPasante: seleccion.rol_asignar === 'pasante',
        isProfessional: seleccion.rol_asignar !== 'pasante',
        isResponsable: seleccion.rol_asignar === 'responsable',
        servicio_id: servicioObj.id, 
        servicio_nombre: servicioObj.nombre, 
        rol: seleccion.rol_asignar, 
        estatus_cuenta: 'activo',
        fecha_asignacion: new Date()
      };

      await updateDoc(doc(db, "Usuarios", uid), datosBase);

      const carpeta = datosBase.isPasante ? "Pasantes" : "Profesionales";
      const perfilCompleto = { ...usuarioAEditar, ...datosBase };
      if (datosBase.isPasante) {
          perfilCompleto.horas_acumuladas = 0;
          perfilCompleto.horario = {}; 
      }
      
      await setDoc(doc(db, servicioObj.id, "Data", carpeta, uid), perfilCompleto, { merge: true });

      setUsuarioAEditar(null);
      setSeleccion({ servicio_id: '', rol_asignar: 'pasante' });
      alert("Usuario activado.");
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const pasantesFiltrados = listaPasantes.filter(p => 
      p.nombre.toLowerCase().includes(busquedaPasante.toLowerCase())
  );

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={{fontWeight:'bold', display:'flex', alignItems:'center', gap:'10px'}}>
            <Shield size={24} color="var(--color-primary)"/> Admin Panel
        </div>
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <button onClick={() => setMostrarGestorHorarios(true)} style={styles.btnNavAction}>
                <Calendar size={18}/> Asignar Horarios
            </button>
            {/* BOTÓN RECUPERADO: GESTIONAR SERVICIOS DESDE NAVBAR */}
            <button onClick={() => setMostrarAdminServicios(true)} style={styles.btnNavActionSecondary}>
                <Settings size={18}/> Servicios
            </button>

            {esDobleRol && <button onClick={cambiarVista} style={styles.btnSwitch}><RefreshCw size={14}/> Rol</button>}
            <button onClick={logoutUser} style={styles.btnLogout}><LogOut size={18}/></button>
        </div>
      </nav>

      <main style={styles.main}>
        {/* SOLICITUDES */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h2 style={{color:'#333', margin:0}}>Solicitudes de Ingreso</h2>
            {usuariosPendientes.length > 0 && <span style={styles.badgeCount}>{usuariosPendientes.length}</span>}
        </div>
        
        <div style={{marginTop:'1.5rem', marginBottom:'3rem'}}>
            {usuariosPendientes.length === 0 ? <div style={styles.emptyState}>Sin pendientes</div> : (
                <div style={styles.grid}>
                    {usuariosPendientes.map(u => (
                        <div key={u.id} style={styles.card}>
                            <div style={{fontWeight:'bold'}}>{u.nombre}</div>
                            <div style={{fontSize:'0.8rem', color:'#666'}}>{u.email}</div>
                            <button onClick={() => setUsuarioAEditar(u)} style={styles.btnAction}><Settings size={16}/> Asignar Rol</button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div style={styles.sectionDivider}><AuditoriaAsistencia /></div>
        
        {/* DIRECTORIO CON EDICIÓN ACTIVADA */}
        <div style={styles.sectionDivider}>
            <h2 style={{color:'#333', display:'flex', alignItems:'center', gap:'10px'}}><Users size={24}/> Directorio</h2>
            <DirectorioUsuarios onEdit={(u) => {
                if(u.rol === 'pasante') {
                    setMostrarGestorHorarios(true);
                    // Pequeño hack para esperar a que se abra el modal y cargue la lista
                    setTimeout(() => inicializarHorario(u), 100);
                } else {
                    alert("Solo se editan horarios de pasantes.");
                }
            }}/>
        </div>

        <div style={styles.sectionDivider}><HistorialGlobal /></div>
      </main>

      {/* --- MODAL 1: ASIGNAR ROL (Nuevos) --- */}
      {usuarioAEditar && (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <div style={styles.modalHeader}>
                    <h3>Activar a: {usuarioAEditar.nombre}</h3>
                    <button onClick={()=>setUsuarioAEditar(null)} style={styles.closeBtn}><X size={24}/></button>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                    <div>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                            <label style={styles.label}>Servicio</label>
                            {/* BOTÓN RECUPERADO: NUEVO SERVICIO */}
                            <button onClick={() => setMostrarAdminServicios(true)} style={styles.btnSmallLink}><PlusCircle size={14}/> Nuevo</button>
                        </div>
                        <select style={styles.input} value={seleccion.servicio_id} onChange={e => setSeleccion({...seleccion, servicio_id: e.target.value})}>
                            <option value="">-- Servicio --</option>
                            {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                    </div>

                    <div>
                        <label style={styles.label}>Rol</label>
                        <select style={styles.input} value={seleccion.rol_asignar} onChange={e=>setSeleccion({...seleccion, rol_asignar:e.target.value})}>
                            <option value="pasante">Pasante</option>
                            <option value="profesional">Staff</option>
                            <option value="responsable">Jefe</option>
                        </select>
                    </div>

                    <button onClick={handleAsignarInicial} style={styles.btnSave} disabled={loading}>Guardar</button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL 2: GESTOR DE HORARIOS (HÍBRIDO V1 + V2) --- */}
      {mostrarGestorHorarios && (
          <div style={styles.modalOverlay}>
              <div style={styles.modalContentWide}>
                  <div style={styles.modalHeader}>
                      <h3>Gestor de Horarios</h3>
                      <button onClick={()=>{setMostrarGestorHorarios(false); setPasanteSeleccionado(null);}} style={styles.closeBtn}><X size={24}/></button>
                  </div>

                  {!pasanteSeleccionado ? (
                      // VISTA A: LISTA DE BÚSQUEDA
                      <>
                        <div style={styles.searchBox}>
                            <Search size={20} color="#999"/>
                            <input placeholder="Buscar pasante..." value={busquedaPasante} onChange={e=>setBusquedaPasante(e.target.value)} style={styles.searchInput} autoFocus/>
                        </div>
                        <div style={styles.listContainer}>
                            {pasantesFiltrados.map(p => (
                                <div key={p.id} onClick={()=>inicializarHorario(p)} style={styles.listItem}>
                                    <div>
                                        <div style={{fontWeight:'bold'}}>{p.nombre}</div>
                                        <div style={{fontSize:'0.8rem', color:'#666'}}>{p.servicio_nombre}</div>
                                    </div>
                                    <button style={styles.btnSmallLink}>Editar Horario</button>
                                </div>
                            ))}
                        </div>
                      </>
                  ) : (
                      // VISTA B: EDICIÓN (HÍBRIDA)
                      <div style={{animation:'fadeIn 0.3s'}}>
                          <div style={{background:'#e3f2fd', padding:'10px', borderRadius:'8px', marginBottom:'1rem', textAlign:'center', fontWeight:'bold', color:'#0d47a1'}}>
                              Editando a: {pasanteSeleccionado.nombre}
                          </div>

                          {/* --- SECCIÓN 1: HERRAMIENTA RÁPIDA (V1) --- */}
                          <div style={styles.batchBox}>
                              <h4 style={{margin:'0 0 10px 0', fontSize:'0.9rem', color:'#555'}}>⚡ Configuración Rápida (Masiva)</h4>
                              <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                                  <div style={{flex:1}}>
                                    <span style={{fontSize:'0.75rem'}}>Entrada</span>
                                    <input type="time" value={batchEntrada} onChange={e=>setBatchEntrada(e.target.value)} style={styles.inputTime}/>
                                  </div>
                                  <div style={{flex:1}}>
                                    <span style={{fontSize:'0.75rem'}}>Salida</span>
                                    <input type="time" value={batchSalida} onChange={e=>setBatchSalida(e.target.value)} style={styles.inputTime}/>
                                  </div>
                              </div>
                              {/* CHIPS DE DÍAS (RECUPERADOS) */}
                              <div style={{display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'10px'}}>
                                  {diasBase.map(dia => (
                                      <div 
                                        key={dia} 
                                        onClick={()=>toggleBatchDia(dia)}
                                        style={batchDias.includes(dia) ? styles.chipActive : styles.chip}
                                      >
                                          {batchDias.includes(dia) ? <CheckSquare size={14}/> : <Square size={14}/>} {dia.substring(0,3)}
                                      </div>
                                  ))}
                              </div>
                              <button onClick={aplicarMasivo} style={styles.btnApply}>
                                  <ArrowDownCircle size={16}/> Aplicar a días seleccionados
                              </button>
                          </div>

                          {/* --- SECCIÓN 2: AJUSTE FINO (V2) --- */}
                          <h4 style={{margin:'15px 0 10px 0', fontSize:'0.9rem', color:'#555'}}>🛠️ Ajuste por Día (Detallado)</h4>
                          <div style={{maxHeight:'40vh', overflowY:'auto', border:'1px solid #eee', borderRadius:'8px'}}>
                              {diasBase.map(dia => {
                                  const config = horarioSemanal[dia];
                                  return (
                                    <div key={dia} style={config.activo ? styles.dayRowActive : styles.dayRow}>
                                        <div style={{display:'flex', alignItems:'center', gap:'10px', width:'110px'}}>
                                            <div 
                                                onClick={() => actualizarDiaIndividual(dia, 'activo', !config.activo)}
                                                style={{cursor:'pointer', color: config.activo ? 'green' : '#ccc'}}
                                            >
                                                {config.activo ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>}
                                            </div>
                                            <span style={{fontWeight:'500', fontSize:'0.9rem', color: config.activo ? '#333' : '#999'}}>{dia}</span>
                                        </div>

                                        <div style={{display:'flex', gap:'5px', flex:1, opacity: config.activo ? 1 : 0.4, pointerEvents: config.activo ? 'all' : 'none'}}>
                                            <input type="time" value={config.entrada} onChange={e=>actualizarDiaIndividual(dia, 'entrada', e.target.value)} style={styles.inputTime}/>
                                            <span style={{alignSelf:'center'}}>-</span>
                                            <input type="time" value={config.salida} onChange={e=>actualizarDiaIndividual(dia, 'salida', e.target.value)} style={styles.inputTime}/>
                                        </div>
                                    </div>
                                  );
                              })}
                          </div>

                          <div style={{display:'flex', gap:'10px', marginTop:'1.5rem'}}>
                              <button onClick={()=>setPasanteSeleccionado(null)} style={styles.btnSecondary}>Cancelar</button>
                              <button onClick={guardarHorarioSemanal} style={styles.btnSave} disabled={loading}>
                                  {loading ? 'Guardando...' : 'Guardar Horario'}
                              </button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* --- MODAL 3: ADMIN SERVICIOS (RECUPERADO) --- */}
      {mostrarAdminServicios && (
          <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                  <div style={styles.modalHeader}>
                      <h3>Gestión de Servicios</h3>
                      <button onClick={()=>setMostrarAdminServicios(false)} style={styles.closeBtn}><X size={24}/></button>
                  </div>
                  <AdminServicios />
              </div>
          </div>
      )}
    </div>
  );
};

// ESTILOS
const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f4f6f9' },
    navbar: { backgroundColor: '#212529', color:'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems:'center', boxShadow:'0 2px 10px rgba(0,0,0,0.1)' },
    btnLogout: { background:'none', border:'none', color:'#ff6b6b', cursor:'pointer' },
    main: { padding: '2rem', maxWidth: '1100px', margin: '0 auto' },
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'1rem' },
    card: { background:'white', padding:'1.5rem', borderRadius:'12px', boxShadow:'0 2px 4px rgba(0,0,0,0.05)', border:'1px solid #eee' },
    emptyState: { textAlign:'center', padding:'2rem', color:'#999', border:'2px dashed #ddd', borderRadius:'12px', background:'#fafafa' },
    btnAction: { width:'100%', padding:'8px', background:'var(--color-primary)', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginTop:'10px' },
    
    // Botones Nav
    btnNavAction: { background:'white', color:'#333', border:'none', padding:'8px 16px', borderRadius:'20px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', fontWeight:'bold', fontSize:'0.9rem' },
    btnNavActionSecondary: { background:'rgba(255,255,255,0.2)', color:'white', border:'none', padding:'8px 16px', borderRadius:'20px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', fontSize:'0.9rem' },
    btnSwitch: { padding: '8px 16px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '20px', border: '1px solid #555', background: '#343a40', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' },
    btnSmallLink: { background:'none', border:'none', color:'var(--color-primary)', cursor:'pointer', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:'4px', fontWeight:'bold' },
    
    sectionDivider: { marginTop:'2rem', borderTop:'1px solid #e0e0e0', paddingTop:'2rem' },
    badgeCount: { background:'#ffc107', color:'#333', padding:'2px 8px', borderRadius:'10px', fontSize:'0.8rem', fontWeight:'bold' },
    
    // Modales
    modalOverlay: { position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.6)', backdropFilter:'blur(2px)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000 },
    modalContent: { backgroundColor:'white', padding:'2rem', borderRadius:'16px', width:'90%', maxWidth:'400px' },
    modalContentWide: { backgroundColor:'white', padding:'2rem', borderRadius:'16px', width:'90%', maxWidth:'600px', maxHeight:'90vh', overflowY:'auto' },
    modalHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', borderBottom:'1px solid #eee', paddingBottom:'10px' },
    closeBtn: { border:'none', background:'none', cursor:'pointer', color:'#666' },
    
    label: { display:'block', marginBottom:'5px', fontWeight:'bold', fontSize:'0.9rem', color:'#444' },
    input: { width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ced4da', fontSize:'0.95rem', marginBottom:'10px' },
    
    // Buscador
    searchBox: { display:'flex', alignItems:'center', gap:'10px', background:'#f8f9fa', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', marginBottom:'1rem' },
    searchInput: { border:'none', background:'transparent', outline:'none', width:'100%', fontSize:'1rem' },
    listContainer: { display:'flex', flexDirection:'column', gap:'5px', maxHeight:'400px', overflowY:'auto' },
    listItem: { padding:'10px', borderBottom:'1px solid #eee', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' },

    // HERRAMIENTA BATCH
    batchBox: { background:'#f8f9fa', padding:'15px', borderRadius:'8px', border:'1px solid #ddd', marginBottom:'15px' },
    chip: { padding:'5px 10px', borderRadius:'15px', border:'1px solid #ccc', fontSize:'0.75rem', cursor:'pointer', background:'white', display:'flex', alignItems:'center', gap:'5px' },
    chipActive: { padding:'5px 10px', borderRadius:'15px', border:'1px solid var(--color-primary)', fontSize:'0.75rem', cursor:'pointer', background:'var(--color-primary)', color:'white', display:'flex', alignItems:'center', gap:'5px' },
    btnApply: { width:'100%', padding:'8px', background:'#6c757d', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' },

    // Filas detalladas
    dayRow: { display:'flex', alignItems:'center', padding:'8px', borderBottom:'1px solid #f0f0f0', background:'white' },
    dayRowActive: { display:'flex', alignItems:'center', padding:'8px', borderBottom:'1px solid #f0f0f0', background:'#f0f8ff' },
    inputTime: { padding:'5px', borderRadius:'4px', border:'1px solid #ddd', width:'100%' },

    btnSave: { flex:1, padding:'12px', background:'#28a745', color:'white', border:'none', borderRadius:'8px', fontSize:'1rem', fontWeight:'bold', cursor:'pointer' },
    btnSecondary: { padding:'12px 20px', background:'#e9ecef', color:'#333', border:'none', borderRadius:'8px', fontSize:'1rem', fontWeight:'bold', cursor:'pointer' }
};

export default DashboardAdmin;