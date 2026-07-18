import { config } from "./config.js";
import { getBase64 } from "./utils.js";

async function request(path, options = {}) {
    const url = `${config.wahaUrl}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        'accept': '*/*',
        ...options.headers
    };
    if (config.apiKey) {
        headers['X-Api-Key'] = config.apiKey;
    }

    // console.log(`[WAHA] ${options.method || 'GET'} ${url}`, options.body ? JSON.parse(options.body) : '');

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
        throw new Error(`WAHA API returned ${response.status}: ${response.statusText} — ${errorDetail}`);
    }
    return response.json();
}

async function downloadFile(path, options = {}) {
  const url = `${config.wahaUrl}${path}`;

  const headers = {
    'Content-Type': options.headers?.['Content-Type'] ?? 'application/json',
    'accept': '*/*',
    ...options.headers
  };

  if (config.apiKey) headers['X-Api-Key'] = config.apiKey;

//   console.log(`[WAHA] ${options.method || 'GET'} ${url}`);

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
    async getVersion() {
        return await request('/api/version');
    },

    async getChats() {
        const data = await request(`/api/${config.session}/chats`);
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

    async getChatMessages(chatId, beforeTimestamp) {
        console.log(`/api/${config.session}/chats/${chatId}/messages?downloadMedia=false&limit=40&sortBy=timestamp${beforeTimestamp ? `&filter.timestamp.gte=${beforeTimestamp}` : "" }`);
        return request(`/api/${config.session}/chats/${chatId}/messages?downloadMedia=false&limit=40${beforeTimestamp ? `&filter.timestamp.lte=${beforeTimestamp}` : "" }`);
    },

    async getSingleChatMessage(chatId, messageId, downladMedia) {
        return request(`/api/${config.session}/chats/${chatId}/messages/${messageId}?downloadMedia=${downladMedia}`);
    },

    async getChatPicture(chatId) {
        return request(`/api/${config.session}/chats/${chatId}/picture`);
    },

    async getUser(chatId) {
        return request(`/api/${config.session}/contacts/${chatId}`);
    },

    async getUserAbout(chatId) {
        return request(`/api/contacts/about?contactId=${chatId}&session=${config.session}`);
    },

    async readChat(chatId) {
        return request('/api/sendSeen', {
            method: 'POST',
            body: JSON.stringify({ chatId, session: config.session })
        });
    },

    async downloadMedia(file) {
        const { blob, filename } = await downloadFile(`/api/files/${config.session}/${file}`);
        return { blob, filename };
    },

    async getMyInfo() {
        return request(`/api/sessions/${config.session}/me`);
    },

    async startTyping(chatId) {
        return request('/api/startTyping', {
            method: 'POST',
            body: JSON.stringify({ chatId, session: config.session })
        });
    },

    async stopTyping(chatId) {
        return request('/api/stopTyping', {
            method: 'POST',
            body: JSON.stringify({ chatId, session: config.session })
        });
    },

    async sendTextMessage(chatId, text) {
        return request('/api/sendText', {
            method: 'POST',
            body: JSON.stringify({
                chatId,
                text,
                session: config.session
            })
        });
    },

    async setStatus(text) {
        return request(`/api/${config.session}/profile/status`, {
            method: 'PUT',
            body: JSON.stringify({
                status: text
            })
        });
    },

    async sendFileMessage(chatId, file) {
        const fileBase64 = await getBase64(file);
        const body = {
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

        const result = await request(endpoint, body);
        return result;
    }
};
