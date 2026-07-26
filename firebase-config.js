/* ============================================================
   Config de Firebase — necesaria para "continuar con google".
   Mientras sea null, la app funciona igual pero solo guarda
   en este dispositivo (localStorage).

   Cómo obtenerla (5 min, gratis):
   1. https://console.firebase.google.com → "Agregar proyecto" (ej: tute)
   2. Authentication → Sign-in method → habilitar "Google"
   3. Authentication → Settings → Authorized domains →
      agregar "facundocouyet.github.io"
   4. Firestore Database → crear base (modo producción) y en
      "Rules" pegar las reglas que están en el README
   5. Configuración del proyecto → "Tus apps" → agregar app web →
      copiar el objeto firebaseConfig y pegarlo acá abajo:

   window.FIREBASE_CONFIG = {
     apiKey: "...",
     authDomain: "tute-xxxxx.firebaseapp.com",
     projectId: "tute-xxxxx",
     appId: "..."
   };
   ============================================================ */
window.FIREBASE_CONFIG = null;
