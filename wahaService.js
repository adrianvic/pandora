import axios from "axios";

const session = "session_01kxc62bk5fs8vh4v127k88a7j";
const wahaBaseUrl = "http://inspiran.beetal-castor.ts.net:3100";
const apiKey = process.env.WAHA_API_KEY;

const client = axios.create({
    baseURL: wahaBaseUrl,
    headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
    }
});

export const wahaService = {
    getConfigStatus() {
        return {
            wahaBaseUrl,
            session,
            hasApiKey: !!apiKey
        };
    },

    async getChats() {
        const response = await client.get(`/api/${session}/chats`, { timeout: 5000 });
        
        if (!Array.isArray(response.data)) {
            throw new Error("Invalid chats response format from WAHA API");
        }

        return response.data.map(chat => {
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
        const response = await client.get(`/api/${session}/chats/${chatId}/messages?downloadMedia=false&merge=true&limit=10`);
        return response.data;
    },

    async getMyInfo(chatId) {
        const response = await client.get(`/api/${session}/me`);
        return response.data;
    },

    async startTyping(chatId) {
        await client.post("/api/startTyping", {
            chatId,
            session
        }, { timeout: 3000 });
    },

    async stopTyping(chatId) {
        await client.post("/api/stopTyping", {
            chatId,
            session
        }, { timeout: 2000 });
    },

    async sendTextMessage(chatId, text) {
        const response = await client.post("/api/sendText", {
            chatId,
            text
        });
        return response.data;
    }
};
