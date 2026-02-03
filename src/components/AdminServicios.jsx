import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Trash2, Plus, Layers } from 'lucide-react';

const AdminServicios = () => {
  const [servicios, setServicios] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState('');

  // Cargar lista de servicios en tiempo real
  useEffect(() => {
    const q = query(collection(db, "CatalogoServicios"), orderBy("nombre"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setServicios(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Agregar Servicio
  const agregar = async (e) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    
    // Convertimos a un ID limpio (ej: "Terapia Física" -> "terapia_fisica")
    // Esto servirá para nombrar la colección en la base de datos
    const idLimpio = nuevoNombre.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    try {
        await addDoc(collection(db, "CatalogoServicios"), {
            nombre: nuevoNombre,
            collectionId: idLimpio // Guardamos cómo se llamará su colección
        });
        setNuevoNombre('');
    } catch (error) {
        alert("Error al crear servicio");
    }
  };

  // Eliminar Servicio
  const eliminar = async (id) => {
    if (!window.confirm("¿Seguro? Esto no borrará los usuarios ya registrados, solo la opción de la lista.")) return;
    await deleteDoc(doc(db, "CatalogoServicios", id));
  };

  return (
    <div>
        <h3 style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <Layers size={20}/> Gestión de Servicios
        </h3>
        
        {/* Formulario Agregar */}
        <form onSubmit={agregar} style={{display:'flex', gap:'10px', marginBottom:'2rem'}}>
            <input 
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                placeholder="Nuevo Servicio (ej: Psicología)"
                style={{flex:1, padding:'10px', borderRadius:'8px', border:'1px solid #ddd'}}
            />
            <button type="submit" style={{padding:'10px 20px', background:'var(--color-primary)', color:'white', border:'none', borderRadius:'8px', cursor:'pointer'}}>
                <Plus size={20}/>
            </button>
        </form>

        {/* Lista */}
        <div style={{display:'grid', gap:'10px'}}>
            {servicios.map(s => (
                <div key={s.id} style={{background:'white', padding:'1rem', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #eee'}}>
                    <div>
                        <strong>{s.nombre}</strong>
                        <div style={{fontSize:'0.8rem', color:'#888'}}>Colección: /{s.collectionId}</div>
                    </div>
                    <button onClick={() => eliminar(s.id)} style={{background:'none', border:'none', color:'#d32f2f', cursor:'pointer'}}>
                        <Trash2 size={18}/>
                    </button>
                </div>
            ))}
        </div>
    </div>
  );
};

export default AdminServicios;