import { loadChat, loadChatsSorted, loadLatestMessages, loadMedia, loadOlderMessages, upsertChats, upsertMedia, upsertMessages } from "./db";
import { waha } from "./waha";
import type { Chat, Message, AppUser, ContactInfo, UserAboutResponse, ChatPictureResponse, StatusResponse, DownloadedMedia } from "./types";

let online = false;
let chats: Chat[] = [];

export async function updateOnlineStatus(): Promise<void> {
  try {
    await waha.getVersion();
    online = true;
  } catch (error) {
    console.log(error);
    online = false;
  }
}

export async function fetchChats(): Promise<void> {
  if (online) {
    await getRemoteChats()
  }
  chats = await loadChatsSorted();
}

export async function getRemoteChats(): Promise<void> {
  const u = await waha.getChats();

  const mapped: Chat[] = u.map(chat => ({
    id: chat.id,
    name: chat.name,
    lastMessage: chat.lastMessage,
    timestamp: chat.timestamp,
    unreadCount: chat.unreadCount ?? 0
  }));

  await upsertChats(mapped);
}

export function getUsers(): Chat[] {
  return chats.filter(c => c.id.endsWith("@c.us"));
}

export function getGroups(): Chat[] {
  return chats.filter(c => c.id.endsWith("@g.us"));
}

export async function getUser(number: string): Promise<ContactInfo | undefined> {
  if (online) {
    return await waha.getUser(number);
  } else {
    return;
  }
}

export async function getUserAbout(userId: string): Promise<UserAboutResponse | undefined> {
  if (online) {
    return await waha.getUserAbout(userId);
  } else {
    return;
  }
}

export function getChats(): Chat[] {
  return chats;
}

export async function getAppUser(): Promise<AppUser> {
  if (online) {
    const info = await waha.getMyInfo();
    localStorage.setItem('pandora-last-username', info.pushName || info.name || '');
    localStorage.setItem('pandora-last-userid', info.id);
    return info;
  } else {
    return {
        pushName: localStorage.getItem('pandora-last-username') || 'Unknown',
        name: localStorage.getItem('pandora-last-username') || 'Unknown',
        id: localStorage.getItem('pandora-last-userid') || 'Unknown'
      } as AppUser;
  }
}

export async function getMessage(chatId: string, msgId: string, downloadMedia: boolean): Promise<Message> {
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
    } as Message;
  }
}

export async function getMedia(reqId: string): Promise<DownloadedMedia | undefined> {
    const cached = await loadMedia(reqId);
    if (cached) {
      return { blob: cached.blob, filename: cached.filename };
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

export async function getChatMessages(chatId: string): Promise<Message[]> {
  if (online) {
    const newMessages = await waha.getChatMessages(chatId);
    upsertMessages(newMessages);
    return newMessages;
  } else {
    return await loadLatestMessages(chatId);
  }
}

export async function getMoreChatMessages(chatId: string, oldestTimestamp: any, oldestId: string): Promise<Message[]> {
  if (online) {
    return waha.getChatMessages(chatId, oldestTimestamp);
  } else {
    return await loadOlderMessages(chatId, oldestTimestamp, oldestId);
  }
}

export async function getChatPicture(chatId: string): Promise<ChatPictureResponse> {
  if (online) {
    return await waha.getChatPicture(chatId);
  } else {
    return { url: "" };
  }
}

export function isOnline(): boolean {
  return online;
}

export async function sendStatus(text: string): Promise<StatusResponse> {
  if (online) {
    return await waha.setStatus(text);
  } else {
    return {
      success: false
    }
  }
}

export async function markRead(chatId: string): Promise<Chat | undefined> {
  if (online) {
    await waha.readChat(chatId);
  }

  const chat = await loadChat(chatId);
  if (chat) {
      chat.unreadCount = 0;
      // Note: upsertMessages was called with [chat] in JS, but chat is a Chat object, not Message.
      // Keeping JS behavior but chat is Chat type here.
      await upsertChats([chat]);
  }
  return chat;
}
