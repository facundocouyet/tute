/* ============================================================
   TUTE · nube — login con Google + guardado por usuario.
   Módulo opcional: si window.FIREBASE_CONFIG es null no carga
   nada de Firebase y la app queda en modo local.

   Expone window.TuteCloud = { enabled, login(), logout(), save(data) }
   Eventos en window:
   - 'tute:ready'                → la nube está lista (o deshabilitada)
   - 'tute:auth' {user, data}    → cambió la sesión; data = doc del usuario
   ============================================================ */
const cfg = window.FIREBASE_CONFIG;

if (!cfg) {
  window.TuteCloud = { enabled: false };
  window.dispatchEvent(new Event('tute:ready'));
} else {
  const V = '10.12.2';
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } = authMod;
  const { getFirestore, doc, getDoc, setDoc } = fsMod;

  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  let uid = null;

  window.TuteCloud = {
    enabled: true,
    login: async () => {
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        // Safari/iOS a veces bloquea el popup: caemos a redirect.
        await signInWithRedirect(auth, provider);
      }
    },
    logout: () => signOut(auth),
    save: async (data) => {
      if (!uid) return;
      try { await setDoc(doc(db, 'users', uid), data, { merge: true }); } catch (e) {}
    },
  };

  onAuthStateChanged(auth, async (u) => {
    uid = u ? u.uid : null;
    let data = null;
    if (u) {
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        data = snap.exists() ? snap.data() : null;
      } catch (e) {}
    }
    window.dispatchEvent(new CustomEvent('tute:auth', {
      detail: {
        user: u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || null } : null,
        data,
      },
    }));
  });

  window.dispatchEvent(new Event('tute:ready'));
}
