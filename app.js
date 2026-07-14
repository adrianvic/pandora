import { config } from "./config.js";
import { waha } from "./waha.js";
import { ui, elements } from "./ui.js";
import { websocket } from "./websocket.js";
import { compensateMessageOrdering, formatTime } from "./utils.js";

let chatsState = [];
let activeChatState = null;
let userInfo;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    try {
        userInfo = await waha.getMyInfo();
        fetchChats();
        checkWahaStatus();
        initWebSocket();
    } catch (error) {
        console.error('Failed to load chats:', error);
        elements.chatList.innerHTML = `
            <li class="loading-chats" style="color: var(--text-primary); text-align: center; padding: 20px;">
                <p>Connection to WAHA failed.</p>
                <p style="font-size: 0.75rem; color: var(--text-primary); margin-top: 8px;">
                    Ensure WAHA server is running and CORS is enabled, or click Settings to configure.
                </p>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">${error.message}</p>
            </li>
        `;
    } finally {
        elements.chatsLoader.classList.add('hidden');
    }
});

function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.code == "Escape") {
            e.preventDefault();
            ui.toggleChatState();
        }
    });

    elements.refreshChatsBtn.addEventListener('click', () => {
        elements.refreshChatsBtn.classList.add('spinning');
        fetchChats().finally(() => {
            setTimeout(() => {
                elements.refreshChatsBtn.classList.remove('spinning');
            }, 600);
        });
    });

    elements.chatSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = chatsState.filter(chat => 
            chat.name.toLowerCase().includes(query)
        );
        ui.renderChatList(filtered, activeChatState, selectChat);
    });

    elements.messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    elements.chatBottomBar.style.height = `${elements.chatInputPanel.offsetHeight}px`;
    const observer = new ResizeObserver(() => {
        elements.chatBottomBar.style.height =
            `${elements.chatInputPanel.offsetHeight}px`;
    });

    observer.observe(elements.chatInputPanel);
    elements.chatBottomBarBtn.addEventListener('click', ui.toggleChatBottomBar);
    elements.chatBottomBar.addEventListener('click', (e) => {
        if (e.target == e.currentTarget) ui.toggleChatBottomBar();
    });

    elements.attachmentBtn.addEventListener('click', () => {
        elements.attachmentInput.click();
    })
    elements.attachmentInput.addEventListener('change', function () {
        const firstFile = this.files[0];
        sendFileMessage(firstFile);
    })

    elements.backToSidebarBtn.addEventListener('click', () => {
        elements.sidebar.classList.remove('hidden');
        elements.activeChatContainer.classList.add('hidden');
    });

    elements.settingsIconBtn.addEventListener('click', openSettings);
    elements.cancelSettingsBtn.addEventListener('click', () => ui.toggleModal(false));
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
}

function initWebSocket() {
    websocket.connect((data) => {
        // console.log('[WS] Received event:', data.event, data);
        const ev = data.event;
        if (ev === 'message' || ev === 'message.any' || ev === 'message.ack') {
            handleIncomingMessage(data.payload);
        }
    });
}

function normalizeChatId(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') {
        return raw._serialized || raw.user || JSON.stringify(raw);
    }
    return raw;
}

function handleIncomingMessage(msg) {
    if (!msg) return;

    // console.log('[WS] handleIncomingMessage payload:', msg);

    const rawChatId = msg.chatId || msg.from || (msg.chat && msg.chat.id);
    const msgChatId = normalizeChatId(rawChatId);
    if (!msgChatId) {
        console.warn('[WS] Could not resolve chatId from payload:', msg);
        return;
    }

    // console.log('[WS] Resolved msgChatId:', msgChatId, '| activeChatState:', activeChatState?.id);

    if (activeChatState && activeChatState.id === msgChatId) {
        const msgId = normalizeChatId(msg.id) || msg.id;
        const exists = document.getElementById(msgId);
        if (!exists) {
            ui.appendSingleMessage({ ...msg, chatId: msgChatId }, activeChatState.name, userInfo.id);
            ui.scrollToBottom();
        }
    }

    const chatIndex = chatsState.findIndex(c => c.id === msgChatId);
    if (chatIndex !== -1) {
        const chat = chatsState[chatIndex];
        chat.lastMessage = msg.body || msg.text || 'Media message';
        chat.timestamp = msg.timestamp ? (msg.timestamp * 1000) : Date.now();

        if (!msg.fromMe && (!activeChatState || activeChatState.id !== msgChatId)) {
            chat.unreadCount = (chat.unreadCount || 0) + 1;
        }

        chatsState.sort((a, b) => {
            const tA = new Date(a.timestamp).getTime();
            const tB = new Date(b.timestamp).getTime();
            return tB - tA;
        });

        // ui.renderChatList(chatsState, activeChatState, selectChat);
    } else {
        // fetchChats();
    }
}

async function fetchChats() {
    try {
        elements.loggedUserName.textContent = userInfo.pushName;
        // elements.userIcon.innerText = userInfo.pushName[0];
        elements.chatsLoader.classList.remove('hidden');
        chatsState = await waha.getChats();
        ui.renderChatList(chatsState, activeChatState, selectChat);
    } catch (error) {
        console.error('Failed to load chats:', error);
        elements.chatList.innerHTML = `
            <li class="loading-chats" style="color: var(--text-primary); text-align: center; padding: 20px;">
                <p>Connection to WAHA failed.</p>
                <p style="font-size: 0.75rem; color: var(--text-primary); margin-top: 8px;">
                    Ensure WAHA server is running and CORS is enabled, or click Settings to configure.
                </p>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">${error.message}</p>
            </li>
        `;
    } finally {
        elements.chatsLoader.classList.add('hidden');
    }
}

async function selectChat(chat) {
    activeChatState = chat;
    
    chat.unreadCount = 0;

    // ui.renderChatList(chatsState, activeChatState, selectChat);

    ui.toggleChatState(true);
    elements.activeChatName.textContent = chat.name.toUpperCase();
    elements.activeChatAvatar.textContent = chat.name ? chat.name.substring(0, 1).toUpperCase() : '?';

    elements.messagesContainer.innerHTML = `
    <div class="loading-chats">
        <div class='dots'>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
        </div>
        <span>Loading messages...
        </span>
    </div>`;
    
    if (window.innerWidth <= 768) {
        elements.sidebar.classList.add('hidden');
    }

    try {
        const rawMessages = await waha.getChatMessages(chat.id);
        const processedMessages = compensateMessageOrdering(rawMessages);
        ui.renderMessages(processedMessages, chat.name, userInfo.id, chat.id);
    } catch (error) {
        console.error('Failed to load messages:', error);
        elements.messagesContainer.innerHTML = '<div class="loading-chats">Error loading messages</div>';
    }
}

async function sendMessage() {
    const text = elements.messageInput.value.trim();
    if (!text || !activeChatState) return;

    elements.messageInput.value = '';

    const tempMsg = {
        id: 'temp-' + Date.now(),
        body: text,
        fromMe: true,
        sender: 'me',
        timestamp: new Date().toISOString(),
        status: 'sending'
    };

    ui.appendSingleMessage(tempMsg, activeChatState.name, userInfo.id);
    ui.scrollToBottom();

    try {
        try {
            await waha.startTyping(activeChatState.id);
            const delay = Math.min(4000, Math.max(1000, text.length * 50));
            await new Promise(resolve => setTimeout(resolve, delay));
        } catch (e) {
            console.warn('Presence start failed:', e);
        }

        try {
            await waha.stopTyping(activeChatState.id);
        } catch (e) {
            console.warn('Presence stop failed:', e);
        }

        try {
            if (!activeChatState.id.endsWith('@lid')) {
                await waha.readChat(activeChatState.id);
            }
        } catch (e) {
            console.warn('readChat failed (non-fatal):', e.message);
        }

        const responseData = await waha.sendTextMessage(activeChatState.id, text);

        const tempBubble = document.getElementById(tempMsg.id);
        if (tempBubble) {
            if (responseData && responseData.id) {
                tempBubble.id = responseData.id;
            }
            const meta = tempBubble.querySelector('.message-meta');
            meta.innerHTML = `<span>${formatTime(new Date())}</span><span style="width:14px; height:14px;" class="mif-done">`;
        }

        activeChatState.lastMessage = text;
        activeChatState.timestamp = new Date();
        
        chatsState.sort((a, b) => {
            const tA = new Date(a.timestamp).getTime();
            const tB = new Date(b.timestamp).getTime();
            return tB - tA;
        });
        // ui.renderChatList(chatsState, activeChatState, selectChat);
    } catch (error) {
        console.error('Failed to send message:', error);
        const tempBubble = document.getElementById(tempMsg.id);
        if (tempBubble) {
            const meta = tempBubble.querySelector('.message-meta');
            meta.innerHTML = `<span style="color: #ef4444;">Failed to send</span>`;
        }
    }
}

async function sendFileMessage(file) {
    try {
        const result = await waha.sendFileMessage(activeChatState.id, file);
        console.log(result)
        // ui.appendSingleMessage(result, activeChatState.name, userInfo.id, activeChatState.id);
    } catch (error) {
        console.error(error.message);
    }
}

function openSettings() {
    elements.inputWahaUrl.value = config.wahaUrl;
    elements.inputSession.value = config.session;
    elements.inputApiKey.value = config.apiKey;
    ui.toggleModal(true);
}

function saveSettings() {
    config.save(
        elements.inputWahaUrl.value,
        elements.inputSession.value,
        elements.inputApiKey.value
    );
    ui.toggleModal(false);
    fetchChats();
    checkWahaStatus();
    initWebSocket();
}

async function checkWahaStatus() {
    try {
        const data = await waha.getVersion();
        ui.updateConnectionStatus(true, `WAHA Connected: v${data.version || 'OK'}`);
    } catch (e) {
        ui.updateConnectionStatus(false, 'WAHA Server Offline');
    }
}
