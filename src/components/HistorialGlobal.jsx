import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Download, Trash2, LogOut, Calendar, Search, FileSpreadsheet } from 'lucide-react';

const HistorialGlobal = () => {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Control de fechas
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1); // 1 = Enero

  // Generar nombre de carpeta (ej: "02_Febrero")
  const obtenerNombreColeccion = (y, m) => {
    const fecha = new Date(y, m - 1, 1);
    const nombreMes = fecha.toLocaleString('es-ES', { month: 'long' });
    const numeroMes = m.toString().padStart(2, '0');
    return `${numeroMes}_${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}`;
  };

  // 1. ESCUCHAR CAMBIOS EN LA FECHA
  useEffect(() => {
    setLoading(true);
    const nombreCarpeta = obtenerNombreColeccion(year, month);
    // Ruta: Asistencias -> 2026 -> 02_Febrero
    const q = query(
        collection(db, "Asistencias", year.toString(), nombreCarpeta),
        orderBy("hora_entrada", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        // Convertimos timestamps a objetos Date de JS para facilitar manejo
        fechaEntrada: d.data().hora_entrada?.toDate(),
        fechaSalida: d.data().hora_salida?.toDate()
      }));
      setRegistros(data);
      setLoading(false);
    }, (error) => {
        console.error(error);
        setRegistros([]); // Si la carpeta no existe (ej: mes futuro), limpiar lista
        setLoading(false);
    });

    return () => unsubscribe();
  }, [year, month]);

  // 2. FUNCIÓN EXPORTAR CSV
  const descargarCSV = () => {
    if (registros.length === 0) return alert("No hay datos para exportar.");

    // Encabezados del CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nombre Pasante,Servicio,Fecha,Hora Entrada,Hora Salida,Horas Totales,Estatus\n";

    registros.forEach(row => {
        const entrada = row.fechaEntrada ? row.fechaEntrada.toLocaleTimeString() : '--';
        const salida = row.fechaSalida ? row.fechaSalida.toLocaleTimeString() : '--';
        const fecha = row.fechaEntrada ? row.fechaEntrada.toLocaleDateString() : '--';
        
        // Cálculo simple de duración si existe salida
        let duracion = '0';
        if(row.fechaEntrada && row.fechaSalida) {
            const diffMs = row.fechaSalida - row.fechaEntrada;
            const diffHrs = diffMs / (1000 * 60 * 60);
            duracion = diffHrs.toFixed(2);
        }

        // Armamos la línea cuidando las comas
        const linea = `${row.nombre_pasante},${row.servicio},${fecha},${entrada},${salida},${duracion},${row.estatus}`;
        csvContent += linea + "\n";
    });

    // Crear enlace de descarga invisible
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Asistencias_${year}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 3. ACCIONES DE ADMIN
  const eliminarRegistro = async (id) => {
    if(!window.confirm("¿Estás seguro de ELIMINAR este registro permanentemente?")) return;
    const nombreCarpeta = obtenerNombreColeccion(year, month);
    try {
        await deleteDoc(doc(db, "Asistencias", year.toString(), nombreCarpeta, id));
    } catch (e) { alert("Error al eliminar"); }
  };

  const forzarSalida = async (id) => {
    if(!window.confirm("¿Marcar salida ahora mismo para este usuario?")) return;
    const nombreCarpeta = obtenerNombreColeccion(year, month);
    try {
        await updateDoc(doc(db, "Asistencias", year.toString(), nombreCarpeta, id), {
            hora_salida: serverTimestamp(),
            estatus: 'finalizado_admin' // Marca especial para saber que fue el admin
        });
    } catch (e) { alert("Error al actualizar"); }
  };

  return (
    <div style={styles.container}>
      {/* HEADER DE CONTROL */}
      <div style={styles.header}>
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <Calendar size={24} color="var(--color-primary)"/>
            <h3 style={{margin:0}}>Historial Global</h3>
        </div>

        <div style={{display:'flex', gap:'10px'}}>
            <select value={year} onChange={e => setYear(e.target.value)} style={styles.select}>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
            </select>
            <select value={month} onChange={e => setMonth(e.target.value)} style={styles.select}>
                {Array.from({length: 12}, (_, i) => (
                    <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('es-ES', {month:'long'})}</option>
                ))}
            </select>
            <button onClick={descargarCSV} style={styles.btnExport}>
                <FileSpreadsheet size={18}/> Exportar Excel/CSV
            </button>
        </div>
      </div>

      {/* TABLA DE DATOS */}
      <div style={styles.tableContainer}>
        {registros.length === 0 ? (
            <div style={{padding:'2rem', textAlign:'center', color:'#888'}}>
                No hay registros en este mes.
            </div>
        ) : (
            <table style={styles.table}>
                <thead>
                    <tr style={{background:'#f8f9fa', textAlign:'left'}}>
                        <th style={styles.th}>Pasante</th>
                        <th style={styles.th}>Servicio</th>
                        <th style={styles.th}>Fecha</th>
                        <th style={styles.th}>Entrada</th>
                        <th style={styles.th}>Salida</th>
                        <th style={styles.th}>Estatus</th>
                        <th style={styles.th}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {registros.map(r => (
                        <tr key={r.id} style={{borderBottom:'1px solid #eee'}}>
                            <td style={styles.td}>
                                <strong>{r.nombre_pasante}</strong>
                            </td>
                            <td style={styles.td}>
                                <span style={styles.tagServicio}>{r.servicio}</span>
                            </td>
                            <td style={styles.td}>
                                {r.fechaEntrada?.toLocaleDateString()}
                            </td>
                            <td style={styles.td} style={{color:'green'}}>
                                {r.fechaEntrada?.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </td>
                            <td style={styles.td}>
                                {r.fechaSalida 
                                    ? r.fechaSalida.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
                                    : <span style={{color:'#999'}}>--:--</span>
                                }
                            </td>
                            <td style={styles.td}>
                                <StatusBadge status={r.estatus} />
                            </td>
                            <td style={styles.td}>
                                <div style={{display:'flex', gap:'5px'}}>
                                    {!r.fechaSalida && (
                                        <button onClick={() => forzarSalida(r.id)} title="Forzar Salida" style={styles.btnActionWarning}>
                                            <LogOut size={14}/>
                                        </button>
                                    )}
                                    <button onClick={() => eliminarRegistro(r.id)} title="Eliminar" style={styles.btnActionDanger}>
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
};

// Pequeño componente visual para el estatus
const StatusBadge = ({ status }) => {
    let color = '#666';
    let bg = '#eee';
    let label = status;

    if(status === 'aprobado' || status === 'finalizado') { color = 'green'; bg = '#e8f5e9'; label = 'Completado'; }
    if(status === 'pendiente_validacion') { color = 'orange'; bg = '#fff3e0'; label = 'Validando Entrada'; }
    if(status === 'pendiente_salida') { color = 'orange'; bg = '#fff3e0'; label = 'Validando Salida'; }
    if(status === 'rechazado') { color = 'red'; bg = '#ffebee'; }

    return (
        <span style={{padding:'4px 8px', borderRadius:'12px', fontSize:'0.75rem', color, backgroundColor: bg, fontWeight:'bold', textTransform:'capitalize'}}>
            {label}
        </span>
    );
};

const styles = {
  container: { marginTop:'2rem', background:'white', borderRadius:'12px', padding:'1.5rem', boxShadow:'0 2px 5px rgba(0,0,0,0.05)' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' },
  select: { padding:'8px', borderRadius:'6px', border:'1px solid #ddd' },
  btnExport: { display:'flex', alignItems:'center', gap:'8px', padding:'8px 16px', background:'#007bff', color:'white', border:'none', borderRadius:'6px', cursor:'pointer' },
  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize:'0.9rem' },
  th: { padding:'12px', color:'#666', borderBottom:'2px solid #eee' },
  td: { padding:'12px' },
  tagServicio: { background:'#f0f0f0', padding:'2px 6px', borderRadius:'4px', fontSize:'0.8rem' },
  btnActionWarning: { background:'#fff3e0', border:'1px solid #ffe0b2', color:'#ef6c00', cursor:'pointer', padding:'5px', borderRadius:'4px' },
  btnActionDanger: { background:'#ffebee', border:'1px solid #ffcdd2', color:'#c62828', cursor:'pointer', padding:'5px', borderRadius:'4px' }
};

export default HistorialGlobal;