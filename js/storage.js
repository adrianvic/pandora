import { loadChatsSorted, loadLatestMessages, loadMedia, loadOlderMessages, upsertChats, upsertMedia, upsertMessages } from "./db.js";
import { waha } from "./waha.js";

let online = false;
let chats = [];

export async function updateOnlineStatus() {
  try {
    await waha.getVersion();
    online = true;
  } catch (error) {
    console.log(error);
    online = false;
  }
}

export async function fetchChats() {
  if (online) {
    await getRemoteChats()
  }
  chats = await loadChatsSorted();
}

export async function getRemoteChats() {
  const u = await waha.getChats();

  const mapped = u.map(chat => ({
    id: chat.id,
    name: chat.name,
    lastMessage: chat.lastMessage,
    timestamp: chat.timestamp,
    unreadCount: chat.unreadCount ?? 0
  }));

  await upsertChats(mapped);
}

export function getUsers() {
  return chats.filter(c => c.id.endsWith("@c.us"));
}

export function getGroups() {
  return chats.filter(c => c.id.endsWith("@g.us"));
}

export async function getUser(number) {
  if (online) {
    return await waha.getUser(number);
  } else {
    return;
  }
}

export async function getUserAbout(userId) {
  if (online) {
    return await waha.getUserAbout(userId);
  } else {
    return;
  }
}

export function getChats() {
  return chats;
}

export async function getAppUser() {
  if (online) {
    const info = await waha.getMyInfo();
    localStorage.setItem('pandora-last-username', info.name);
    localStorage.setItem('pandora-last-userid', info.id);
    return info;
  } else {
    return {
        pushName: localStorage.getItem('pandora-last-username') || 'Unknown',
        id: localStorage.getItem('pandora-last-userid') || 'Unknown'
      }
  }
}

export async function getMessage(chatId, msgId, downloadMedia) {
  if (online) {
    const newMessage = await waha.getSingleChatMessage(chatId, msgId, downloadMedia);
    upsertMessages([newMessage]);
    return newMessage;
  } else {
    return {
      id: `${Date.now()}-temp`,
      body: "You're offline",
      from: "system",
      timestamp: new Date().toISOString()
    };
  }
}

export async function getMedia(reqId) {
    const cached = await loadMedia(reqId);
    if (cached) {
      return cached;
    }

    try {
      if (online) {
        const media = await waha.downloadMedia(reqId);
        upsertMedia(reqId, media.blob, media.filename);
        return media;
      }
    } catch (error) {
      return;
    }
}

export async function getChatMessages(chatId) {
  if (online) {
    const newMessages = await waha.getChatMessages(chatId);
    upsertMessages(newMessages);
    return newMessages;
  } else {
    return await loadLatestMessages(chatId);
  }
}

export async function getMoreChatMessages(chatId, oldestTimestamp, oldestId, limit = 50) {
  if (online) {
    return waha.getChatMessages(chatId, oldestTimestamp);
  } else {
    return await loadOlderMessages(chatId, oldestTimestamp, oldestId);
  }
}

export async function getChatPicture(chatId) {
  if (online) {
    return await waha.getChatPicture(chatId);
  } else {
    return { url: "" };
  }
}

export function isOnline() {
  return online;
}

export async function sendStatus(text) {
  if (online) {
    return await waha.setStatus(text);
  } else {
    return {
      success: false
    }
  }
}