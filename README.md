# tute · contador

Contador de tute con cartas españolas, como app web estática (mobile-first).

- **Partida**: elegís quiénes juegan, cada mano se piden bazas y se cargan las ganadas; el puntaje se calcula solo (cumplís: 5 + lo pedido · fallás: restás la diferencia).
- **Planilla**: total acumulado mano a mano, con manos falladas y manos sin triunfo marcadas.
- **Torneo**: serie de partidas donde el puesto de cada una suma puntos; gana quien menos junta.
- **Jugadores**: nombres, colores y selfie para el avatar.
- **Reglas**: cómo se juega, con la mano fallada animada sobre la mesa.

Todo el estado vive en `localStorage` del dispositivo. Sin dependencias ni build: HTML + CSS + JS.

Diseño: sistema NEWRO (tipografías Mondwest, Formula Condensed y Gosha Sans).

## Login con Google (opcional)

Si `firebase-config.js` tiene una config válida, aparece "continuar con google": el
usuario que entra queda como organizador y sus partidas terminadas se guardan en su
cuenta (Firestore), así las estadísticas lo siguen entre teléfono y computadora.
Mientras la config sea `null`, la app funciona igual pero guarda solo en el dispositivo.

### Cómo crear el proyecto de Firebase

1. Entrá a <https://console.firebase.google.com> con tu Gmail y creá un proyecto (ej. `tute`).
   Google Analytics podés dejarlo desactivado.
2. **Authentication** → *Comenzar* → pestaña *Sign-in method* → habilitá **Google** y guardá.
3. **Authentication** → *Settings* → *Authorized domains* → agregá `facundocouyet.github.io`
   (`localhost` ya viene incluido).
4. **Firestore Database** → *Crear base de datos* → modo producción, región `southamerica-east1`.
   En la pestaña *Rules* pegá esto y publicá — cada usuario solo puede leer y escribir lo suyo:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

5. **Configuración del proyecto** (⚙️) → *Tus apps* → ícono `</>` (web) → registrá la app
   (sin hosting) → copiá el objeto `firebaseConfig`.
6. Pegá ese objeto en `firebase-config.js` reemplazando `window.FIREBASE_CONFIG = null;`.

La `apiKey` de Firebase es pública por diseño (va en el HTML de cualquier app web); lo que
protege los datos son las reglas de Firestore del paso 4.

### Datos que se guardan

En `users/{uid}`: jugadores, partida en curso, torneo en curso e `history` (últimas 300
partidas terminadas, con jugadores, totales y puestos). El historial alimenta las
estadísticas de la pestaña *jugadores*.
