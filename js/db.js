// ============================================================
//  CAPA DE DATOS
//  La app solo habla con estas funciones. Por debajo usa
//  Firebase (si hay config) o localStorage (modo prueba).
//
//  Colecciones:
//   users/{personId}  → { pinHash, hints: {...}, budget }
//   wishes/{wishId}   → { owner, title, exact, link, details, price,
//                         priority, note, image, reactions: {persona: stickerId},
//                         createdAt, updatedAt }
//   gifts/{wishId}    → { wishId, owner, wishTitle, participants: [personas],
//                         price, status: reservado|comprado|envuelto, updatedAt }
//                       (mismo id que el deseo → un deseo solo tiene un regalo)
//   comments/{id}     → { listOwner, author, text, stickerId, createdAt }
//
//  🤫 La dueña de una lista NUNCA pide sus gifts ni sus comments.
// ============================================================
import { FIREBASE_CONFIG } from './config.js';

const FIREBASE_VERSION = '10.12.2';
let backend = null;

export async function initDB() {
  backend = FIREBASE_CONFIG ? await createFirebaseBackend() : createLocalBackend();
  return backend.mode;
}

export const dbMode = () => backend?.mode;
const byDate = (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0);

// ---- Usuarias ----
export const getPinHash = (id) => backend.getUser(id).then((u) => u?.pinHash ?? null);
export const setPinHash = (id, pinHash) => backend.mergeUser(id, { pinHash });
export const getHints   = (id) => backend.getUser(id).then((u) => u?.hints ?? {});
export const setHints   = (id, hints) => backend.mergeUser(id, { hints });
export const getBudget  = (id) => backend.getUser(id).then((u) => u?.budget ?? null);
export const setBudget  = (id, budget) => backend.mergeUser(id, { budget });

// ---- Deseos ----
export const listWishes    = (owner) => backend.listWishes(owner).then((l) => l.sort(byDate));
export const listAllWishes = () => backend.listWishes(null).then((l) => l.sort(byDate));
export const addWish    = (wish) => backend.addWish({ ...wish, reactions: {}, createdAt: Date.now(), updatedAt: Date.now() });
export const updateWish = (id, data) => backend.updateWish(id, { ...data, updatedAt: Date.now() });
export const deleteWish = (id) => backend.deleteWish(id);
export const setReaction = (wishId, personId, stickerId) => backend.setReaction(wishId, personId, stickerId);

// ---- Regalos (reservas) ----
export const listGiftsFor = (owner) => backend.listGifts({ owner });
export const listMyGifts  = (me) => backend.listGifts({ participant: me });
export const listAllGifts = () => backend.listGifts({});
export const joinGift   = (wish, me) => backend.joinGift(wish, me);
export const leaveGift  = (wishId, me) => backend.leaveGift(wishId, me);
export const updateGift = (wishId, data) => backend.updateGift(wishId, { ...data, updatedAt: Date.now() });

// ---- Chat secreto ----
// Llama a `callback(listaDeMensajes)` cada vez que cambia. Devuelve una función para dejar de escuchar.
export const watchComments = (listOwner, callback) =>
  backend.watchComments(listOwner, (list) => callback(list.sort(byDate)));
export const addComment = (c) => backend.addComment({ ...c, createdAt: Date.now() });
export const countComments = (listOwner) => backend.countComments(listOwner);

// ---- Reset total (borra usuarias, PIN, pistas, deseos, regalos y chats) ----
export const resetEverything = () => backend.resetAll();

// ============================================================
//  Firebase (datos compartidos entre todas)
// ============================================================
async function createFirebaseBackend() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const { initializeApp } = await import(`${base}/firebase-app.js`);
  const { getAuth, signInAnonymously } = await import(`${base}/firebase-auth.js`);
  const fs = await import(`${base}/firebase-firestore.js`);

  const app = initializeApp(FIREBASE_CONFIG);
  await signInAnonymously(getAuth(app)); // las reglas exigen estar "dentro" de la app
  const db = fs.getFirestore(app);
  const col = (name) => fs.collection(db, name);
  const ref = (name, id) => fs.doc(db, name, id);
  const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return {
    mode: 'firebase',
    async getUser(id) {
      const snap = await fs.getDoc(ref('users', id));
      return snap.exists() ? snap.data() : null;
    },
    async mergeUser(id, data) {
      await fs.setDoc(ref('users', id), data, { merge: true });
    },

    async listWishes(owner) {
      const q = owner ? fs.query(col('wishes'), fs.where('owner', '==', owner)) : col('wishes');
      return docs(await fs.getDocs(q));
    },
    async addWish(wish) { return (await fs.addDoc(col('wishes'), wish)).id; },
    async updateWish(id, data) { await fs.updateDoc(ref('wishes', id), data); },
    async deleteWish(id) { await fs.deleteDoc(ref('wishes', id)); },
    async setReaction(wishId, personId, stickerId) {
      await fs.updateDoc(ref('wishes', wishId), {
        [`reactions.${personId}`]: stickerId || fs.deleteField(),
      });
    },

    async listGifts({ owner, participant }) {
      let q = col('gifts');
      if (owner) q = fs.query(q, fs.where('owner', '==', owner));
      if (participant) q = fs.query(q, fs.where('participants', 'array-contains', participant));
      return docs(await fs.getDocs(q));
    },
    async joinGift(wish, me) {
      // Transacción: si dos se apuntan a la vez, no se pisan
      await fs.runTransaction(db, async (tx) => {
        const r = ref('gifts', wish.id);
        const snap = await tx.get(r);
        if (snap.exists()) {
          tx.update(r, { participants: fs.arrayUnion(me), updatedAt: Date.now() });
        } else {
          tx.set(r, {
            wishId: wish.id, owner: wish.owner, wishTitle: wish.title,
            participants: [me], price: wish.price ?? null,
            status: 'reservado', updatedAt: Date.now(),
          });
        }
      });
    },
    async leaveGift(wishId, me) {
      await fs.runTransaction(db, async (tx) => {
        const r = ref('gifts', wishId);
        const snap = await tx.get(r);
        if (!snap.exists()) return;
        const rest = (snap.data().participants || []).filter((p) => p !== me);
        rest.length ? tx.update(r, { participants: rest, updatedAt: Date.now() }) : tx.delete(r);
      });
    },
    async updateGift(wishId, data) { await fs.updateDoc(ref('gifts', wishId), data); },

    watchComments(listOwner, callback) {
      const q = fs.query(col('comments'), fs.where('listOwner', '==', listOwner));
      return fs.onSnapshot(q, (snap) => callback(docs(snap)));
    },
    async addComment(c) { await fs.addDoc(col('comments'), c); },
    async countComments(listOwner) {
      const q = fs.query(col('comments'), fs.where('listOwner', '==', listOwner));
      return (await fs.getCountFromServer(q)).data().count;
    },
    async resetAll() {
      for (const name of ['wishes', 'gifts', 'comments', 'users']) {
        const snap = await fs.getDocs(col(name));
        let batch = fs.writeBatch(db);
        let n = 0;
        for (const d of snap.docs) {
          batch.delete(d.ref);
          if (++n === 450) { await batch.commit(); batch = fs.writeBatch(db); n = 0; } // máx. 500 por lote
        }
        if (n) await batch.commit();
      }
    },
  };
}

// ============================================================
//  Modo prueba (solo este dispositivo)
// ============================================================
function createLocalBackend() {
  const KEY = 'navibeneyto.demo';
  const empty = () => ({ users: {}, wishes: {}, gifts: {}, comments: {} });
  const read = () => {
    try { return { ...empty(), ...JSON.parse(localStorage.getItem(KEY)) }; }
    catch { return empty(); }
  };
  const write = (data) => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch { throw new Error('No queda espacio en este navegador (prueba con fotos más pequeñas)'); }
  };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const entries = (obj) => Object.entries(obj).map(([id, v]) => ({ id, ...v }));
  const change = (fn) => { const all = read(); const r = fn(all); write(all); return r; };
  const listeners = new Set();
  const notify = () => listeners.forEach((l) => l());

  return {
    mode: 'local',
    async getUser(id) { return read().users[id] ?? null; },
    async mergeUser(id, data) { change((a) => { a.users[id] = { ...a.users[id], ...data }; }); },

    async listWishes(owner) { return entries(read().wishes).filter((w) => !owner || w.owner === owner); },
    async addWish(wish) { return change((a) => { const id = uid(); a.wishes[id] = wish; return id; }); },
    async updateWish(id, data) { change((a) => { a.wishes[id] = { ...a.wishes[id], ...data }; }); },
    async deleteWish(id) { change((a) => { delete a.wishes[id]; }); },
    async setReaction(wishId, personId, stickerId) {
      change((a) => {
        const r = { ...(a.wishes[wishId].reactions || {}) };
        if (stickerId) r[personId] = stickerId; else delete r[personId];
        a.wishes[wishId].reactions = r;
      });
    },

    async listGifts({ owner, participant }) {
      return entries(read().gifts).filter((g) =>
        (!owner || g.owner === owner) && (!participant || g.participants.includes(participant)));
    },
    async joinGift(wish, me) {
      change((a) => {
        const g = a.gifts[wish.id];
        if (g) { if (!g.participants.includes(me)) g.participants.push(me); g.updatedAt = Date.now(); }
        else a.gifts[wish.id] = { wishId: wish.id, owner: wish.owner, wishTitle: wish.title,
          participants: [me], price: wish.price ?? null, status: 'reservado', updatedAt: Date.now() };
      });
    },
    async leaveGift(wishId, me) {
      change((a) => {
        const g = a.gifts[wishId];
        if (!g) return;
        g.participants = g.participants.filter((p) => p !== me);
        if (!g.participants.length) delete a.gifts[wishId];
      });
    },
    async updateGift(wishId, data) { change((a) => { a.gifts[wishId] = { ...a.gifts[wishId], ...data }; }); },

    watchComments(listOwner, callback) {
      const run = () => callback(entries(read().comments).filter((c) => c.listOwner === listOwner));
      listeners.add(run);
      run();
      return () => listeners.delete(run);
    },
    async addComment(c) { change((a) => { a.comments[uid()] = c; }); notify(); },
    async countComments(listOwner) { return entries(read().comments).filter((c) => c.listOwner === listOwner).length; },
    async resetAll() { try { localStorage.removeItem(KEY); } catch {} notify(); },
  };
}
