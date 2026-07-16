import { loadChatsSorted, loadLatestMessages, loadMedia, upsertChats, upsertMedia, upsertMessages } from "./db.js";
import { waha } from "./waha.js";

let user;
let chats = [];

export async function fetchChats() {
  try {
    await getRemoteChats()
  } catch (error) {

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

export function getUser(number) {
  return users.find(user => user.id === number);
}

export function getChats() {
  return chats;
}

export async function getAppUser() {
  if (user) {
    return user;
  } else {
    try {
      return await waha.getMyInfo();
    } catch (error) {
      console.error(error);
      return {
        pushName: "Unknown",
        id: "Unknown"
      }
    }
  }
}

export async function getMessage(chatId, msgId, downloadMedia) {
  try {
    const newMessage = await waha.getSingleChatMessage(chatId, msgId, downloadMedia);
    upsertMessages([newMessage]);
    return newMessage;
  } catch (error) {
    return {
      id: `${Date.now()}-temp`,
      body: "You're offline",
      from: "system",
      timestamp: new Date().toISOString()
    };
  }
}

export async function getMedia(reqId) {
  try {
    const media = await waha.downloadMedia(reqId);
    upsertMedia(reqId, media.blob, media.filename);
    return media;
  } catch (error) {
    const cached = await loadMedia(reqId);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

export async function getChatMessages(chatId) {
  try {
    const newMessages = await waha.getChatMessages(chatId);
    upsertMessages(newMessages);
    return newMessages;
  } catch (error) {
    return await loadLatestMessages(chatId);
  }
}

export async function getChatPicture(chatId) {
  try {
    return await waha.getChatPicture(chatId);
  } catch (error) {
    return "";
  }
}