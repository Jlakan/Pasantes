// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/variables.css';
import { UserProvider } from './context/UserContext'; // <--- Importamos

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Envolvemos la App para que tenga acceso al usuario en todos lados */}
    <UserProvider>
      <App />
    </UserProvider>
  </React.StrictMode>
);
