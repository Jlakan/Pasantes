import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { 
  collection, query, getDocs, where, doc, getDoc 
} from 'firebase/firestore'; 
import { 
  Search, User, FileText, Clock, X, 
  Shield, Calendar, AlertTriangle, ChevronRight
} from 'lucide-react';

const DirectorioUsuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  
  // Estado para el modal de perfil
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  
  // Datos internos del perfil
  const [actividad, setActividad] = useState([]);
  const [reportes, setReportes] = useState([]);
  const [datosServicio, setDatosServicio] = useState(null);

  // Estado para el modal de REPORTE INDIVIDUAL
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);

  // 1. CARGAR LISTA GENERAL DE USUARIOS
  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        // Traemos todos los usuarios ordenados por nombre (esto no suele dar problemas de índices)
        const q = query(collection(db, "Usuarios")); 
        const snap = await getDocs(q);
        
        // Ordenamos en cliente por si acaso
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        lista.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
        
        setUsuarios(lista);
      } catch (error) { console.error("Error cargando usuarios:", error); }
    };
    cargarUsuarios();
  }, []);

  // --- FUNCIÓN AUXILIAR PARA OBTENER RUTA DEL MES ACTUAL ---
  const getRutaMesActual = () => {
    const hoy = new Date();
    const year = hoy.getFullYear().toString();
    const mesNombre = hoy.toLocaleString('es-ES', { month: 'long' });
    const mesNumero = (hoy.getMonth() + 1).toString().padStart(2, '0');
    // Ejemplo: 02_Febrero
    const nombreCarpetaMes = `${mesNumero}_${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}`;
    
    // Retorna la referencia a la colección: Asistencias/2026/02_Febrero
    return collection(db, "Asistencias", year, nombreCarpetaMes);
  };

  // 2. ABRIR PERFIL
  const abrirPerfil = async (usuario) => {
    setUsuarioSeleccionado(usuario);
    setReporteSeleccionado(null);
    setLoadingDetalle(true);
    setActividad([]);
    setReportes([]);
    setDatosServicio(null);

    try {
      // --- LOGICA COMÚN: ACTIVIDAD RECIENTE (MES ACTUAL) ---
      const colRefMes = getRutaMesActual();
      let qActividad;

      // NOTA: Quitamos 'orderBy' de la consulta Firebase para evitar error de índices en carpetas dinámicas.
      // Ordenaremos los resultados en Javascript.

      if (usuario.isPasante) {
        // A. SI ES PASANTE: Buscar donde él es el alumno ('uid_pasante')
        qActividad = query(colRefMes, where('uid_pasante', '==', usuario.id));
        
        // Carga de Datos Extra (Horas acumuladas)
        if (usuario.servicio_id) {
            const docRef = doc(db, usuario.servicio_id, "Data", "Pasantes", usuario.id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) setDatosServicio(docSnap.data());
        }

        // Carga de Reportes (Colección Global)
        const repQuery = query(collection(db, "Reportes"), where("uid_pasante", "==", usuario.id)); 
        const repSnap = await getDocs(repQuery);
        
        const reportesData = repSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Ordenar reportes por fecha descendente
        reportesData.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0)); 
        setReportes(reportesData);
      } 
      else if (usuario.isProfessional || usuario.isResponsable) {
        // B. SI ES STAFF: Buscar donde él es el jefe ('uid_responsable')
        qActividad = query(colRefMes, where('uid_responsable', '==', usuario.id));
      }

      // EJECUTAR CONSULTA DE ACTIVIDAD Y ORDENAR
      if (qActividad) {
          try {
            const actSnap = await getDocs(qActividad);
            
            // 1. Mapear datos
            let docsOrdenados = actSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // 2. Ordenar en JS (Más reciente primero)
            docsOrdenados.sort((a, b) => {
                const fechaA = a.hora_entrada?.seconds || 0;
                const fechaB = b.hora_entrada?.seconds || 0;
                return fechaB - fechaA;
            });

            // 3. Guardar (limitamos a 50 para no saturar)
            setActividad(docsOrdenados.slice(0, 50));

          } catch (e) {
              // Si la carpeta del mes no existe aún (ej: principio de mes sin registros), esto fallará silenciosamente
              console.log("Sin registros en el mes actual o carpeta inexistente.");
          }
      }

    } catch (error) {
      console.error("Error general abriendo perfil:", error);
    }
    setLoadingDetalle(false);
  };

  const usuariosFiltrados = usuarios.filter(u => 
    u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || 
    u.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.servicio_nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={styles.container}>
      <div style={styles.searchBar}>
        <Search size={20} color="#666" />
        <input 
          placeholder="Buscar usuario por nombre, servicio..." 
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.grid}>
        {usuariosFiltrados.map(u => (
          <div key={u.id} onClick={() => abrirPerfil(u)} style={styles.card}>
            <div style={styles.cardHeader}>
                <div style={styles.avatar}>
                    {u.foto_url ? <img src={u.foto_url} alt="foto" style={styles.img} /> : <User size={24} />}
                </div>
                <div>
                    <h4 style={{margin:0}}>{u.nombre}</h4>
                    <span style={{fontSize:'0.8rem', color:'#666'}}>{u.email}</span>
                </div>
            </div>
            <div style={styles.badges}>
                <span style={styles.badgeServicio}>{u.servicio_nombre || "Sin Servicio"}</span>
                <span style={{...styles.badgeRol, background: u.isPasante ? '#e8f5e9' : '#e3f2fd', color: u.isPasante ? '#2e7d32' : '#1565c0'}}>
                    {u.rol}
                </span>
            </div>
          </div>
        ))}
      </div>

      {/* --- MODAL PRINCIPAL: PERFIL DE USUARIO --- */}
      {usuarioSeleccionado && (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <button onClick={() => setUsuarioSeleccionado(null)} style={styles.closeBtn}><X size={24}/></button>
                
                <div style={{textAlign:'center', marginBottom:'2rem'}}>
                    <img src={usuarioSeleccionado.foto_url} alt="Perfil" style={styles.bigAvatar}/>
                    <h2 style={{margin:'10px 0 5px 0'}}>{usuarioSeleccionado.nombre}</h2>
                    <p style={{color:'#666', margin:0}}>{usuarioSeleccionado.rol} • {usuarioSeleccionado.servicio_nombre}</p>
                </div>

                {loadingDetalle ? (
                    <div style={{textAlign:'center', padding:'2rem'}}>Cargando...</div>
                ) : (
                    <div style={styles.modalBody}>
                        
                        {usuarioSeleccionado.isPasante && (
                            <>
                                <div style={styles.statBox}>
                                    <Clock size={24} color="var(--color-primary)"/>
                                    <div>
                                        <div style={{fontSize:'0.8rem', color:'#666'}}>HORAS ACUMULADAS</div>
                                        <div style={{fontSize:'1.5rem', fontWeight:'bold'}}>
                                            {datosServicio?.horas_acumuladas ? datosServicio.horas_acumuladas.toFixed(2) : '0.00'} hrs
                                        </div>
                                    </div>
                                </div>

                                <h4 style={styles.sectionTitle}><AlertTriangle size={18} color="#d32f2f"/> Reportes / Incidencias</h4>
                                {reportes.length === 0 ? <p style={styles.empty}>Sin reportes registrados.</p> : (
                                    <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                                        {reportes.map(rep => (
                                            <div 
                                                key={rep.id} 
                                                onClick={() => setReporteSeleccionado(rep)}
                                                style={styles.reportCard}
                                            >
                                                <div style={{flex:1}}>
                                                    <strong style={{color:'#d32f2f', textTransform:'uppercase'}}>
                                                        {rep.motivo || rep.gravedad || "Incidencia"}
                                                    </strong>
                                                    <div style={{fontSize:'0.75rem', color:'#666'}}>
                                                        {rep.fecha?.seconds 
                                                            ? new Date(rep.fecha.seconds * 1000).toLocaleDateString() 
                                                            : "Fecha desconocida"}
                                                    </div>
                                                    <div style={{fontSize:'0.85rem', color:'#444', marginTop:'2px'}}>
                                                        {rep.descripcion ? rep.descripcion.substring(0, 40) + '...' : ''}
                                                    </div>
                                                </div>
                                                <div style={{display:'flex', alignItems:'center', gap:'5px', fontSize:'0.8rem', color:'var(--color-primary)'}}>
                                                    Ver <ChevronRight size={16}/>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        <h4 style={styles.sectionTitle}>
                            <Calendar size={18}/> Actividad del Mes
                        </h4>
                        
                        <div style={styles.activityList}>
                            {actividad.length === 0 ? <p style={styles.empty}>No hay actividad registrada este mes.</p> : (
                                actividad.map(act => (
                                    <div key={act.id} style={styles.activityItem}>
                                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'4px'}}>
                                            <span style={{fontWeight:'bold', fontSize:'0.9rem'}}>
                                                {/* Si es pasante viendo su perfil, decimos "Asistencia". Si es Staff, mostramos el nombre del alumno */}
                                                {usuarioSeleccionado.isPasante ? 'Asistencia' : act.nombre_pasante}
                                            </span>
                                            <span style={{fontSize:'0.8rem', color: act.estatus==='aprobado' ? 'green' : 'orange'}}>
                                                {act.estatus}
                                            </span>
                                        </div>
                                        
                                        <div style={{fontSize:'0.8rem', color:'#666'}}>
                                            {act.hora_entrada?.toDate().toLocaleDateString()} | 
                                            {act.hora_entrada?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - 
                                            {act.hora_salida ? act.hora_salida.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- SUB-MODAL: DETALLE DEL REPORTE (CON CAMPOS CORREGIDOS) --- */}
      {reporteSeleccionado && (
          <div style={styles.modalOverlaySecondary}>
              <div style={styles.modalContentSmall}>
                  <div style={styles.modalHeader}>
                      <h3 style={{margin:0, color:'#d32f2f', display:'flex', alignItems:'center', gap:'10px'}}>
                          <AlertTriangle size={24}/> Detalles del Reporte
                      </h3>
                      <button onClick={() => setReporteSeleccionado(null)} style={styles.closeBtnStatic}><X size={24}/></button>
                  </div>

                  <div style={{padding:'1rem 0'}}>
                      <label style={styles.label}>Motivo / Gravedad</label>
                      <p style={{...styles.value, textTransform: 'uppercase', fontWeight: 'bold'}}>
                          {reporteSeleccionado.motivo || reporteSeleccionado.gravedad || "No especificado"}
                      </p>

                      <label style={styles.label}>Fecha</label>
                      <p style={styles.value}>
                          {reporteSeleccionado.fecha?.seconds ? new Date(reporteSeleccionado.fecha.seconds * 1000).toLocaleString() : 'Sin fecha'}
                      </p>

                      <label style={styles.label}>Descripción</label>
                      <div style={styles.textBox}>
                          {reporteSeleccionado.descripcion || reporteSeleccionado.observaciones || "Sin descripción detallada."}
                      </div>

                      {reporteSeleccionado.foto_url && (
                          <div style={{marginTop:'1rem'}}>
                              <label style={styles.label}>Evidencia</label>
                              <img src={reporteSeleccionado.foto_url} alt="Evidencia" style={{width:'100%', borderRadius:'8px', border:'1px solid #ddd'}}/>
                          </div>
                      )}
                      
                      <label style={styles.label}>Reportado Por</label>
                      <p style={styles.value}>
                          {reporteSeleccionado.nombre_jefe || "Desconocido"} 
                          <span style={{fontSize:'0.75rem', color:'#999', display:'block'}}>
                              ID: {reporteSeleccionado.uid_jefe || reporteSeleccionado.uid_responsable || "N/A"}
                          </span>
                      </p>
                  </div>

                  <button onClick={() => setReporteSeleccionado(null)} style={styles.btnBack}>
                      Cerrar
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

const styles = {
  container: { marginTop: '2rem' },
  searchBar: { display:'flex', alignItems:'center', gap:'10px', background:'white', padding:'12px', borderRadius:'12px', border:'1px solid #ddd', marginBottom:'1.5rem' },
  searchInput: { border:'none', outline:'none', fontSize:'1rem', width:'100%', color:'#333' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:'1rem' },
  card: { background:'white', padding:'1rem', borderRadius:'12px', border:'1px solid #eee', cursor:'pointer', transition:'transform 0.2s' },
  cardHeader: { display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' },
  avatar: { width:'40px', height:'40px', borderRadius:'50%', background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  img: { width:'100%', height:'100%', objectFit:'cover' },
  badges: { display:'flex', gap:'5px', flexWrap:'wrap' },
  badgeServicio: { fontSize:'0.7rem', padding:'2px 6px', background:'#f5f5f5', borderRadius:'4px', color:'#666' },
  badgeRol: { fontSize:'0.7rem', padding:'2px 6px', borderRadius:'4px', fontWeight:'bold' },
  modalOverlay: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', zIndex:3000, display:'flex', justifyContent:'center', alignItems:'center', padding:'20px' },
  modalContent: { background:'white', width:'100%', maxWidth:'500px', maxHeight:'90vh', borderRadius:'20px', padding:'2rem', position:'relative', overflowY:'auto' },
  closeBtn: { position:'absolute', top:'15px', right:'15px', background:'none', border:'none', cursor:'pointer' },
  bigAvatar: { width:'80px', height:'80px', borderRadius:'50%', border:'4px solid white', boxShadow:'0 5px 15px rgba(0,0,0,0.1)' },
  modalBody: { display:'flex', flexDirection:'column', gap:'1.5rem' },
  statBox: { background:'var(--color-primary-light)', padding:'1rem', borderRadius:'12px', display:'flex', alignItems:'center', gap:'15px', border:'1px solid #bbdefb' },
  sectionTitle: { margin:'0', display:'flex', alignItems:'center', gap:'8px', fontSize:'1rem', color:'#333', borderBottom:'1px solid #eee', paddingBottom:'5px' },
  empty: { color:'#999', fontSize:'0.9rem', fontStyle:'italic' },
  reportCard: { display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff5f5', border:'1px solid #ffcdd2', padding:'10px', borderRadius:'8px', cursor:'pointer' },
  activityList: { display:'flex', flexDirection:'column', gap:'10px' },
  activityItem: { background:'#f9f9f9', padding:'10px', borderRadius:'8px', border:'1px solid #eee' },
  modalOverlaySecondary: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', zIndex:4000, display:'flex', justifyContent:'center', alignItems:'center', padding:'20px' },
  modalContentSmall: { background:'white', width:'100%', maxWidth:'400px', borderRadius:'16px', padding:'1.5rem', boxShadow:'0 10px 30px rgba(0,0,0,0.3)' },
  modalHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #eee', paddingBottom:'10px' },
  closeBtnStatic: { background:'none', border:'none', cursor:'pointer', color:'#666' },
  label: { display:'block', fontSize:'0.75rem', fontWeight:'bold', color:'#999', marginTop:'10px', textTransform:'uppercase' },
  value: { margin:'2px 0 10px 0', fontWeight:'500', color:'#333' },
  textBox: { background:'#f9f9f9', padding:'10px', borderRadius:'8px', border:'1px solid #eee', fontSize:'0.9rem', color:'#444', minHeight:'60px' },
  btnBack: { width:'100%', marginTop:'1rem', padding:'12px', background:'#eee', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', color:'#333' }
};

export default DirectorioUsuarios;