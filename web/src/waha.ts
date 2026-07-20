import { config } from "./config";
import { showNotification } from "./notification";
import { getBase64 } from "./utils";
import type { Message, VersionResponse, AppUser, ContactInfo, UserAboutResponse, ChatPictureResponse, StatusResponse } from "./types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${config.wahaUrl}${path}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'accept': '*/*',
        ...(options.headers as Record<string, string>)
    };
    if (config.apiKey) {
        headers['X-Api-Key'] = config.apiKey;
    }

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        let errorDetail = '';
        try {
            const errBody = await response.json();
            errorDetail = JSON.stringify(errBody);
            console.error(`[WAHA] Error response body:`, errBody);
        } catch (_) {
            errorDetail = await response.text().catch(() => '');
        }

        showNotification("API Error", `WAHA API returned ${response.status}: ${response.statusText} — ${errorDetail}`, 4000);
        throw new Error(`WAHA API returned ${response.status}: ${response.statusText} — ${errorDetail}`);
    }
    return response.json();
}

async function downloadFile(path: string, options: RequestInit = {}): Promise<{ blob: Blob, filename: string }> {
  const url = `${config.wahaUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': (options.headers as Record<string, string> | undefined)?.['Content-Type'] ?? 'application/json',
    'accept': '*/*',
    ...(options.headers as Record<string, string>)
  };

  if (config.apiKey) headers['X-Api-Key'] = config.apiKey;

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let errorDetail = '';
    try {
      errorDetail = JSON.stringify(await response.json());
    } catch (_) {
      errorDetail = await response.text().catch(() => '');
    }
    throw new Error(`WAHA API returned ${response.status}: ${response.statusText} — ${errorDetail}`);
  }

  const blob = await response.blob();

  let filename = 'download';
  const cd = response.headers.get('content-disposition');
  if (cd) {
    const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
    filename = decodeURIComponent(m?.[1] || m?.[2] || filename);
  }

  return { blob, filename };
}

export const waha = {
    async getVersion(): Promise<VersionResponse> {
        return await request<VersionResponse>('/api/version');
    },

    async getChats(): Promise<any[]> {
        const data = await request<any[]>(`/api/${config.session}/chats`);
        return data.map(chat => {
            let chatId = chat.id;
            if (chatId && typeof chatId === "object") {
                chatId = chatId._serialized || chatId.user || JSON.stringify(chatId);
            }
            return {
                id: chatId || chat.chatId || chat.name,
                name: chat.name || "Unknown Contact",
                unreadCount: chat.unreadCount || 0,
                lastMessage: chat.lastMessage?.body || chat.lastMessageText || "Click to open chat",
                timestamp: chat.lastMessage?.timestamp || new Date()
            };
        });
    },

    async getChatMessages(chatId: string, beforeTimestamp?: any): Promise<Message[]> {
        return request<Message[]>(`/api/${config.session}/chats/${chatId}/messages?downloadMedia=false&limit=40${beforeTimestamp ? `&filter.timestamp.lte=${beforeTimestamp}` : "" }`);
    },

    async getSingleChatMessage(chatId: string, messageId: string, downloadMedia: boolean): Promise<Message> {
        return request<Message>(`/api/${config.session}/chats/${chatId}/messages/${messageId}?downloadMedia=${downloadMedia}`);
    },

    async getChatPicture(chatId: string): Promise<ChatPictureResponse> {
        return request<ChatPictureResponse>(`/api/${config.session}/chats/${chatId}/picture`);
    },

    async getUser(chatId: string): Promise<ContactInfo> {
        return request<ContactInfo>(`/api/${config.session}/contacts/${chatId}`);
    },

    async getUserAbout(chatId: string): Promise<UserAboutResponse> {
        return request<UserAboutResponse>(`/api/contacts/about?contactId=${chatId}&session=${config.session}`);
    },

    async readChat(chatId: string): Promise<any> {
        return request('/api/sendSeen', {
            method: 'POST',
            body: JSON.stringify({ chatId, session: config.session })
        });
    },

    async downloadMedia(file: string): Promise<{ blob: Blob, filename: string }> {
        const { blob, filename } = await downloadFile(`/api/files/${config.session}/${file}`);
        return { blob, filename };
    },

    async getMyInfo(): Promise<AppUser> {
        return request<AppUser>(`/api/sessions/${config.session}/me`);
    },

    async startTyping(chatId: string): Promise<any> {
        return request('/api/startTyping', {
            method: 'POST',
            body: JSON.stringify({ chatId, session: config.session })
        });
    },

    async stopTyping(chatId: string): Promise<any> {
        return request('/api/stopTyping', {
            method: 'POST',
            body: JSON.stringify({ chatId, session: config.session })
        });
    },

    async sendTextMessage(chatId: string, text: string): Promise<Message> {
        return request<Message>('/api/sendText', {
            method: 'POST',
            body: JSON.stringify({
                chatId,
                text,
                session: config.session
            })
        });
    },

    async setStatus(text: string): Promise<StatusResponse> {
        return request<StatusResponse>(`/api/${config.session}/profile/status`, {
            method: 'PUT',
            body: JSON.stringify({
                status: text
            })
        });
    },

    async sendFileMessage(chatId: string, file: File): Promise<Message> {
        const fileBase64 = await getBase64(file);
        const body: RequestInit = {
            method: 'POST',
            body: JSON.stringify({
                chatId,
                file: {
                    mimetype: file.type,
                    filename: file.name,
                    data: fileBase64
                },
                session: config.session
            })
        };

        let endpoint = "/api/sendFile";

        if (file.type.startsWith('image/')) endpoint = '/api/sendImage';
        if (file.type.startsWith('video/')) endpoint = '/api/sendVideo';

        const result = await request<Message>(endpoint, body);
        return result;
    }
};
