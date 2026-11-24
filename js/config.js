// ============================================================
//  CONFIGURACIÓN DE NAVIBENEYTO 2.0
//  Aquí se cambia todo lo "personal" de la app.
// ============================================================

export const PEOPLE = [
  { id: 'marisa', name: 'Marisa', color: '#e63946' },
  { id: 'anab',   name: 'Ana B.', color: '#2a9d8f' },
  { id: 'anac',   name: 'Ana C.', color: '#f4a261' },
  { id: 'blanca', name: 'Blanca', color: '#9b8bd4' },
  { id: 'nuria',  name: 'Nuria',  color: '#e9c46a' },
];

export const getPerson = (id) => PEOPLE.find((p) => p.id === id);

// Momento de los regalos: 24 de diciembre a las 23:00 (hora de Madrid).
export const GIFT_MOMENT = { day: 24, month: 12, hour: 23, minute: 0 };

// ------------------------------------------------------------
//  FIREBASE
//  Conexión con la base de datos compartida.
// ------------------------------------------------------------
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBkOvjnBeUUXpJ2wwAiepM-7hfwKajICLM",
  authDomain: "navibeneyto.firebaseapp.com",
  projectId: "navibeneyto",
  storageBucket: "navibeneyto.firebasestorage.app",
  messagingSenderId: "817120094908",
  appId: "1:817120094908:web:e281244786d3629b357eb9"
};
/* Ejemplo de cómo quedará:
export const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "navibeneyto.firebaseapp.com",
  projectId: "navibeneyto",
  storageBucket: "navibeneyto.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/
