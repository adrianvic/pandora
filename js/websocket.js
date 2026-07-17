import { config } from "./config.js";
import { isOnline, updateOnlineStatus } from "./storage.js";

let socket = null;
let reconnectTimer = null;
let currentOnMessageCallback = null;

export const websocket = {
    connect(onMessageCallback) {
        if (!isOnline) return;
        currentOnMessageCallback = onMessageCallback;

        this.disconnect(false);

        const httpUrl = config.wahaUrl;
        if (!httpUrl) {
            console.warn('[WS] Config wahaUrl is empty. Cannot connect.');
            return;
        }

        let wsUrl = httpUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
        wsUrl = wsUrl.replace(/\/$/, '') + '/ws';

        const apiKey = config.apiKey;
        const session = config.session;
        const events = ['session.status', 'message.any'];

        const queryParams = new URLSearchParams();
        if (apiKey) {
            queryParams.append('x-api-key', apiKey);
        }
        queryParams.append('session', session);
        events.forEach(event => queryParams.append('events', event));

        const fullWsUrl = `${wsUrl}?${queryParams.toString()}`;
        console.log('[WS] Connecting to:', fullWsUrl);

        try {
            socket = new WebSocket(fullWsUrl);

            socket.onopen = () => {
                console.log('[WS] Connection successfully established');
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (currentOnMessageCallback) {
                        currentOnMessageCallback(data);
                    }
                } catch (e) {
                    console.error('[WS] Failed to parse message JSON:', e);
                }
            };

            socket.onerror = (error) => {
                console.error('[WS] WebSocket Error occurred:', error);
            };

            socket.onclose = (event) => {
                console.log(`[WS] Connection closed (code: ${event.code}). Reconnecting in 5 seconds...`);
                socket = null;
                
                reconnectTimer = setTimeout(() => {
                    updateOnlineStatus();
                    this.connect(currentOnMessageCallback);
                }, 5000);
            };
        } catch (e) {
            console.error('[WS] Failed to initialize WebSocket client:', e);
        }
    },

    disconnect(clearCallback = true) {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (clearCallback) {
            currentOnMessageCallback = null;
        }
        if (socket) {
            socket.onclose = null;
            socket.onerror = null;
            socket.onopen = null;
            socket.onmessage = null;
            socket.close();
            socket = null;
            console.log('[WS] Connection closed explicitly');
        }
    }
};
