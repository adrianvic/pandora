import { deleteChatFromDatabase, loadChat, loadChatsSorted, loadLatestMessages, loadMedia, loadOlderMessages, upsertChats, upsertMedia, upsertMessages } from "./db";
import { waha } from "./waha";
import type { Chat, Message, AppUser, ContactInfo, UserAboutResponse, ChatPictureResponse, StatusResponse, DownloadedMedia, GroupUser, Contact } from "./types";

let online = false;
let chats: Chat[] = [];

export async function updateOnlineStatus(): Promise<void> {
  try {
    await waha.getVersion();
    online = true;
  } catch (error) {
    console.log("[Storage] Online check failed:", error);
    online = false;
  }
}

/**
 * Fetches chats from local DB first, then attempts to sync with remote.
 * Calls onUpdate whenever the internal 'chats' list changes.
 */
export async function fetchChats(onUpdate?: () => void): Promise<void> {
  chats = await loadChatsSorted();
  if (onUpdate) onUpdate();

  try {
    await getRemoteChats();
    chats = await loadChatsSorted();
    if (onUpdate) onUpdate();
  } catch (error) {
    console.warn("[Storage] Could not sync remote chats:", error);
  }
}

export async function getRemoteChats(): Promise<void> {
  const u = await waha.getChats();

  const mapped: Chat[] = u.map(chat => ({
    id: chat.id,
    name: chat.name,
    lastMessage: chat.lastMessage,
    timestamp: chat.timestamp,
    unreadCount: chat.unreadCount ?? 0,
    archived: chat.archived
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
  try {
    return await waha.getUser(number);
  } catch (e) {
    return undefined;
  }
}

export async function getUserAbout(userId: string): Promise<UserAboutResponse | undefined> {
  try {
    return await waha.getUserAbout(userId);
  } catch (e) {
    return undefined;
  }
}

const contactCache = new Map<string, Contact>();

export async function getContact(id: string): Promise<Contact | undefined> {
  const cached = contactCache.get(id);
  if (cached) return cached;

  try {
    const contact = await waha.getContact(id);
    if (contact) contactCache.set(id, contact);
    return contact;
  } catch (e) {
    return undefined;
  }
}

export function getChats(): Chat[] {
  return chats;
}

export async function getAppUser(): Promise<AppUser> {
  try {
    const info = await waha.getMyInfo();
    localStorage.setItem('pandora-last-username', info.pushName || info.name || '');
    localStorage.setItem('pandora-last-userid', info.id);
    return info;
  } catch (error) {
    return {
      pushName: localStorage.getItem('pandora-last-username') || 'Unknown',
      name: localStorage.getItem('pandora-last-username') || 'Unknown',
      id: localStorage.getItem('pandora-last-userid') || 'Unknown'
    } as AppUser;
  }
}

export async function getMessage(chatId: string, msgId: string, downloadMedia: boolean): Promise<Message> {
  try {
    const newMessage = await waha.getSingleChatMessage(chatId, msgId, downloadMedia);
    upsertMessages([newMessage]);
    return newMessage;
  } catch (error) {
    // If offline and not in cache, returning a stub or attempting local search might be better.
    // For now, let the error propagate or return a fallback.
    return {
      id: msgId,
      body: "Unable to retrieve message content.",
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
    const media = await waha.downloadMedia(reqId);
    upsertMedia(reqId, media.blob, media.filename);
    return media;
  } catch (error) {
    return undefined;
  }
}

/**
 * Loads messages from local DB first, then attempts to sync with remote.
 */
export async function getChatMessages(chatId: string, onUpdate?: (msgs: Message[]) => void, limit = 40): Promise<Message[]> {
  const localMsgs = await loadLatestMessages(chatId);
  if (onUpdate && localMsgs.length > 0) onUpdate(localMsgs);

  try {
    const newMessages = await waha.getChatMessages(chatId);
    await upsertMessages(newMessages);
    const updated = await loadLatestMessages(chatId, limit);
    if (onUpdate) onUpdate(updated);
    return updated;
  } catch (error) {
    console.warn(`[Storage] Could not sync remote messages for ${chatId}:`, error);
    return localMsgs;
  }
}

export async function getMoreChatMessages(chatId: string, oldestTimestamp: any, oldestId: string): Promise<Message[]> {
  try {
    const remote = await waha.getChatMessages(chatId, oldestTimestamp);
    await upsertMessages(remote);
    return remote;
  } catch (error) {
    return await loadOlderMessages(chatId, oldestTimestamp, oldestId);
  }
}

export async function getChatPicture(chatId: string): Promise<ChatPictureResponse> {
  try {
    return await waha.getChatPicture(chatId);
  } catch (error) {
    return { url: "" };
  }
}

export function isOnline(): boolean {
  return online;
}

export async function sendStatus(text: string): Promise<StatusResponse> {
  try {
    return await waha.setStatus(text);
  } catch (error) {
    return { success: false };
  }
}

export async function markRead(chatId: string): Promise<Chat | undefined> {
  try {
    await waha.readChat(chatId);
  } catch (e) {
    console.warn("[Storage] markRead network failure (will retry via SW if configured):", e);
  }

  const chat = await loadChat(chatId);
  if (chat) {
    chat.unreadCount = 0;
    await upsertChats([chat]);
  }
  return chat;
}

export async function getGroupUsers(groupId: string): Promise<GroupUser[] | undefined> {
  try {
    return await waha.getGroupUsers(groupId);
  } catch (e) {
    return undefined;
  }
}

export async function getUsersFromGroup(users: (GroupUser | undefined)[]): Promise<(Contact | undefined)[]> {
  return Promise.all(
    users.map(async u => {
      if (u?.id._serialized) {
        return await getContact(u.id._serialized);
      }
      return undefined;
    })
  );
}

export async function deleteChat(chatId: string) {
  await deleteChatFromDatabase(chatId);
  try {
    await waha.deleteChat(chatId);
  } catch (e) {
    console.warn("[Storage] deleteChat network failure:", e);
  }
}

export async function toggleArchiveChat(chatId: string): Promise<boolean> {
  const chat = await loadChat(chatId);
  if (!chat) return false;

  chat.archived = !chat.archived;
  upsertChats([chat]);

  try {
    if (chat.archived) {
      await waha.archiveChat(chatId);
    } else {
      await waha.unarchiveChat(chatId);
    }

    return(chat.archived);
  } catch (e) {
    console.warn("[Storage] archiveChat network failure:", e);
    return chat.archived;
  }
}
