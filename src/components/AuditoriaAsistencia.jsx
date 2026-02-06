import React, { useState } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ClipboardList, Check, X, AlertTriangle, Search } from 'lucide-react';

const AuditoriaAsistencia = () => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null); // null | { presentes: [], faltas: [] }

  // Función auxiliar para obtener carpeta del mes
  const getRutaMes = () => {
    const hoy = new Date();
    const year = hoy.getFullYear().toString();
    const mesNombre = hoy.toLocaleString('es-ES', { month: 'long' });
    const mesNumero = (hoy.getMonth() + 1).toString().padStart(2, '0');
    return { year, carpeta: `${mesNumero}_${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}` };
  };

  const realizarAuditoria = async () => {
    setLoading(true);
    setResultado(null);
    try {
      const hoy = new Date();
      const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const diaActual = diasSemana[hoy.getDay()];
      
      console.log("Auditando día:", diaActual);

      // 1. Obtener TODOS los Pasantes Activos
      const qUsuarios = query(
          collection(db, "Usuarios"), 
          where("rol", "==", "pasante"),
          where("estatus_cuenta", "==", "activo")
      );
      const snapUsuarios = await getDocs(qUsuarios);
      const todosPasantes = snapUsuarios.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Filtrar solo los que les toca trabajar HOY
      // (Asumimos que guardaste 'dias: ["Lunes", "Martes"]' en el objeto horario del usuario)
      const debenAsistir = todosPasantes.filter(p => 
          p.horario?.dias && p.horario.dias.includes(diaActual)
      );

      // 3. Obtener Asistencias de HOY
      const { year, carpeta } = getRutaMes();
      
      // Calculamos inicio y fin del día para filtrar registros de HOY
      const inicioDia = new Date(hoy.setHours(0,0,0,0));
      const finDia = new Date(hoy.setHours(23,59,59,999));

      const qAsistencias = query(
          collection(db, "Asistencias", year, carpeta),
          where("hora_entrada", ">=", inicioDia),
          where("hora_entrada", "<=", finDia)
      );
      
      const snapAsistencias = await getDocs(qAsistencias);
      const uidsAsistieron = snapAsistencias.docs.map(d => d.data().uid_pasante);

      // 4. Cruzar información: ¿Quién debía venir y NO está en la lista de asistencias?
      const listaFaltas = [];
      const listaPresentes = [];

      debenAsistir.forEach(pasante => {
          if (uidsAsistieron.includes(pasante.id)) {
              listaPresentes.push(pasante);
          } else {
              listaFaltas.push(pasante);
          }
      });

      setResultado({
          dia: diaActual,
          presentes: listaPresentes,
          faltas: listaFaltas
      });

    } catch (error) {
      console.error("Error auditando:", error);
      alert("Error al realizar la auditoría. Revisa consola.");
    }
    setLoading(false);
  };

  // Función para registrar la falta oficialmente en la BD
  const registrarFalta = async (pasante) => {
      if(!window.confirm(`¿Generar reporte de Falta para ${pasante.nombre}?`)) return;
      
      try {
          await addDoc(collection(db, "Reportes"), {
              uid_pasante: pasante.id,
              nombre_pasante: pasante.nombre,
              foto_pasante: pasante.foto_url,
              servicio: pasante.servicio_nombre,
              
              tipo: 'falta_automatica',
              gravedad: 'moderada', // Puedes cambiar a 'grave' si prefieres
              motivo: 'Inasistencia injustificada',
              descripcion: `El sistema detectó que el usuario no registró asistencia el día ${new Date().toLocaleDateString()}.`,
              
              fecha: serverTimestamp(),
              uid_jefe: 'SISTEMA',
              nombre_jefe: 'Auditoría Automática'
          });
          alert("Falta registrada en el expediente.");
          
          // Actualizamos la lista visualmente quitándolo de pendientes
          setResultado(prev => ({
              ...prev,
              faltas: prev.faltas.filter(p => p.id !== pasante.id)
          }));

      } catch (error) {
          console.error(error);
          alert("Error al guardar falta");
      }
  };

  return (
    <div style={styles.card}>
        <div style={styles.header}>
            <h3 style={{display:'flex', alignItems:'center', gap:'10px', margin:0}}>
                <ClipboardList size={24}/> Auditoría de Asistencia Diaria
            </h3>
            <button onClick={realizarAuditoria} disabled={loading} style={styles.btnCheck}>
                {loading ? 'Analizando...' : <><Search size={16}/> Verificar Hoy</>}
            </button>
        </div>
        
        <p style={{fontSize:'0.9rem', color:'#666', marginBottom:'1.5rem'}}>
            Esta herramienta busca pasantes que debían asistir hoy pero no registraron entrada.
        </p>

        {resultado && (
            <div style={styles.resultBox}>
                <div style={{fontWeight:'bold', marginBottom:'10px', borderBottom:'1px solid #ddd', paddingBottom:'5px'}}>
                    Resultados del día: {resultado.dia}
                </div>

                <div style={{display:'flex', gap:'20px', flexWrap:'wrap'}}>
                    {/* COLUMNA PRESENTES */}
                    <div style={{flex:1, minWidth:'250px'}}>
                        <h4 style={{color:'#28a745', display:'flex', alignItems:'center', gap:'5px'}}>
                            <Check size={18}/> Asistieron ({resultado.presentes.length})
                        </h4>
                        <div style={styles.list}>
                            {resultado.presentes.map(p => (
                                <div key={p.id} style={styles.itemSuccess}>{p.nombre}</div>
                            ))}
                            {resultado.presentes.length===0 && <small>Nadie ha llegado aún.</small>}
                        </div>
                    </div>

                    {/* COLUMNA FALTAS */}
                    <div style={{flex:1, minWidth:'250px'}}>
                        <h4 style={{color:'#dc3545', display:'flex', alignItems:'center', gap:'5px'}}>
                            <X size={18}/> Ausentes / Sin Registro ({resultado.faltas.length})
                        </h4>
                        <div style={styles.list}>
                            {resultado.faltas.map(p => (
                                <div key={p.id} style={styles.itemDanger}>
                                    <div>
                                        <strong>{p.nombre}</strong>
                                        <div style={{fontSize:'0.75rem'}}>Servicio: {p.servicio_nombre}</div>
                                    </div>
                                    <button 
                                        onClick={() => registrarFalta(p)}
                                        style={styles.btnReport}
                                        title="Generar Reporte de Falta"
                                    >
                                        <AlertTriangle size={14}/> Reportar
                                    </button>
                                </div>
                            ))}
                            {resultado.faltas.length===0 && <small style={{color:'green'}}>¡Felicidades! Todos asistieron.</small>}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

const styles = {
    card: { background:'white', padding:'1.5rem', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)', marginTop:'2rem', border:'1px solid #e0e0e0' },
    header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' },
    btnCheck: { background:'var(--color-primary)', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', display:'flex', alignItems:'center', gap:'8px' },
    resultBox: { background:'#f8f9fa', padding:'1rem', borderRadius:'8px', border:'1px solid #eee' },
    list: { display:'flex', flexDirection:'column', gap:'5px', maxHeight:'300px', overflowY:'auto' },
    itemSuccess: { padding:'8px', background:'white', borderLeft:'4px solid #28a745', borderRadius:'4px', fontSize:'0.9rem', boxShadow:'0 1px 2px rgba(0,0,0,0.05)' },
    itemDanger: { padding:'8px', background:'white', borderLeft:'4px solid #dc3545', borderRadius:'4px', fontSize:'0.9rem', boxShadow:'0 1px 2px rgba(0,0,0,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' },
    btnReport: { background:'#ffebee', color:'#c62828', border:'1px solid #ffcdd2', padding:'5px 10px', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', fontSize:'0.75rem', fontWeight:'bold' }
};

export default AuditoriaAsistencia;