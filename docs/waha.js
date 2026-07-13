import { config } from "./config.js";

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

    console.log(`[WAHA] ${options.method || 'GET'} ${url}`, options.body ? JSON.parse(options.body) : '');

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

export const waha = {
    async getVersion() {
        return request('/api/version');
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

    async getChatMessages(chatId) {
        return request(`/api/${config.session}/chats/${chatId}/messages?downloadMedia=false&limit=40`);
    },

    async getChatPicture(chatId) {
        return request(`/api/${config.session}/chats/${chatId}/picture`);
    },

    async readChat(chatId) {
        return request('/api/sendSeen', {
            method: 'POST',
            body: JSON.stringify({ chatId, session: config.session })
        });
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
    }
};
