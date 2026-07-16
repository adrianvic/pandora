const DB_NAME = "pandora";
const DB_VERSION = 6;
let dbPromise = null;

function normalizeId(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') {
    return raw._serialized || raw.user || JSON.stringify(raw);
  }
  return raw;
}

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = req.result;
      const tx = req.transaction;

      if (!db.objectStoreNames.contains("chats")) {
        const store = db.createObjectStore("chats", { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }

      let msgStore;
      if (!db.objectStoreNames.contains("messages")) {
        msgStore = db.createObjectStore("messages", { keyPath: "id" });
        msgStore.createIndex("from", "from", { unique: false });
        msgStore.createIndex("fingerprint", ["from", "timestamp"], { unique: false });
      } else {
        msgStore = tx.objectStore("messages");
      }

      if (!msgStore.indexNames.contains("chatId_timestamp")) {
        msgStore.createIndex("chatId_timestamp", ["chatId", "timestamp"], { unique: false });
      }

      if (db.objectStoreNames.contains("messages")) {
        msgStore.openCursor().onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const m = cursor.value;
            const from = normalizeId(m.from);
            const to = normalizeId(m.to);
            const chatId = normalizeId(m.chatId) || (m.fromMe ? to : from);
            if (!m.chatId && chatId) {
              m.chatId = chatId;
              cursor.update(m);
            }
            cursor.continue();
          }
        };
      }

      if (!db.objectStoreNames.contains("media")) {
        db.createObjectStore("media", { keyPath: "reqId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

export async function upsertChats(chats) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("chats", "readwrite");
    const store = tx.objectStore("chats");

    for (const c of chats) {
      store.put({
        id: c.id,
        name: c.name,
        lastMessage: c.lastMessage,
        timestamp: c.timestamp,
        unreadCount: c.unreadCount ?? 0
      });
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadChatsSorted() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("chats", "readonly");
    const store = tx.objectStore("chats");
    const idx = store.index("timestamp");

    const result = [];
    idx.openCursor(null, "prev").onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        result.push(cursor.value);
        cursor.continue();
      } else {
        resolve(result);
      }
    };

    tx.onerror = () => reject(tx.error);
  });
}

function mapMessage(m) {
  const from = normalizeId(m.from);
  const to = normalizeId(m.to);
  const chatId = normalizeId(m.chatId) || (m.fromMe ? to : from);

  return {
    _data: m._data,
    id: m.id,
    timestamp: m.timestamp,
    body: m.body,
    from: from,
    fromMe: m.fromMe,
    ack: m.ack,
    hasMedia: m.hasMedia,
    media: m.media,
    chatId: chatId,
  }
}

export async function upsertMessages(messages) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");

    for (const m of messages) {
      store.put(mapMessage(m));
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadLatestMessages(chatId, limit = 50) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const idx = store.index("chatId_timestamp");

    const out = [];

    const range = IDBKeyRange.bound([chatId, -Infinity], [chatId, Infinity]);

    idx.openCursor(range, "prev").onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return resolve(out);

      out.push(cursor.value);
      if (out.length >= limit) resolve(out);
      else cursor.continue();
    };

    tx.onerror = () => reject(tx.error);
  });
}

export async function upsertMedia(reqId, blob, filename) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("media", "readwrite");
    const store = tx.objectStore("media");

    store.put({
      reqId: reqId,
      blob: blob,
      filename: filename
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadMedia(reqId) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("media", "readonly");
    const store = tx.objectStore("media");
    const req = store.get(reqId);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}