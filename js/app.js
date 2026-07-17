import { config } from "./config.js";
import { waha } from "./waha.js";
import { ui, elements } from "./ui.js";
import { websocket } from "./websocket.js";
import { compensateMessageOrdering, formatTime, normalizeId } from "./utils.js";
import { fetchChats, getAppUser, getChatMessages, getChats, updateOnlineStatus } from "./storage.js";
import { upsertMessages } from "./db.js";

let activeChatState = null;
const messageTone = new Audio("./message.ogg");

document.addEventListener('DOMContentLoaded', async () => {
    elements.inputApiKey.value = config.apiKey;
    elements.inputWahaUrl.value = config.wahaUrl;
    elements.inputSession.value = config.session;
    await updateOnlineStatus();
    setupEventListeners();
    try {
        elements.loggedUserName.textContent = (await getAppUser()).pushName;
        loadChats();
        checkWahaStatus();
        initWebSocket();
    } finally {
        elements.chatsLoader.classList.add('hidden');
    }
});

function loadChats() {
    try {
        elements.chatsLoader.classList.remove('hidden');
        fetchChats().then(() => { 
            ui.renderChatList(getChats(), activeChatState, selectChat);
            
            const hash = window.location.hash;
            if (hash && hash.startsWith('#chat-')) {
                const chatId = hash.replace('#chat-', '');
                const chat = getChats().find(c => c.id === chatId);
                if (chat) {
                    selectChat(chat, true, false);
                }
            }
        });
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

let isScrollingProgrammatically = false;
let scrollTimeout = null;

function scrollToChat(smooth = true) {
    isScrollingProgrammatically = true;
    elements.appContainer.scrollTo({
        left: elements.appContainer.clientWidth,
        behavior: smooth ? 'smooth' : 'auto'
    });
    setTimeout(() => { isScrollingProgrammatically = false; }, smooth ? 400 : 50);
}

function scrollToList(smooth = true) {
    isScrollingProgrammatically = true;
    elements.appContainer.scrollTo({
        left: 0,
        behavior: smooth ? 'smooth' : 'auto'
    });
    setTimeout(() => { isScrollingProgrammatically = false; }, smooth ? 400 : 50);
}

function setupEventListeners() {
    if (!window.location.hash) {
        window.location.hash = '';
    }
    
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#chat-')) {
            const chatId = hash.replace('#chat-', '');
            const chat = getChats().find(c => c.id === chatId);
            if (chat) {
                selectChat(chat, true);
            }
        } else {
            closeActiveChat(true);
        }
    });

    elements.appContainer.addEventListener('scroll', () => {
        if (window.innerWidth > 768) return;
        if (isScrollingProgrammatically) return;
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const scrollLeft = elements.appContainer.scrollLeft;
            const width = elements.appContainer.clientWidth;
            
            if (scrollLeft < width * 0.2) {
                // User swiped back to the list view
                if (activeChatState) {
                    closeActiveChat(false);
                }
            }
        }, 100);
    });

    document.addEventListener('keydown', (e) => {
        if (e.code == "Escape") {
            e.preventDefault();
            closeActiveChat(false);
        }
    });
    
    elements.chatSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = getChats().filter(chat => 
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
        closeActiveChat(false);
    });

    elements.desktopSidebarButtons.forEach(sidebarBtn => {
        sidebarBtn.addEventListener('click', () => {
            ui.showExtraPage(sidebarBtn.dataset.page);           
        })
    })

    elements.saveSettingsBtn.addEventListener('click', saveSettings);
}

function initWebSocket() {
    websocket.connect((data) => {
        // console.log('[WS] Received event:', data.event, data);
        const ev = data.event;
        if (ev === 'message' || ev === 'message.any' || ev === 'message.ack') {
            handleIncomingMessage(data.payload);
            upsertMessages([data.payload]);
        }
    });
}


async function handleIncomingMessage(msg) {
    if (!msg) return;
    
    // console.log('[WS] handleIncomingMessage payload:', msg);
    
    ui.updateChatInChatList(msg);
    
    const rawChatId = msg.chatId || msg.from || (msg.chat && msg.chat.id);
    const msgChatId = normalizeId(rawChatId);
    if (!msgChatId) {
        console.warn('[WS] Could not resolve chatId from payload:', msg);
        return;
    }
    
    // console.log('[WS] Resolved msgChatId:', msgChatId, '| activeChatState:', activeChatState?.id);
    if (!msg.fromMe) {
        messageTone.play();
    }
    
    if (activeChatState && activeChatState.id === msgChatId) {
        const msgId = normalizeId(msg.id) || msg.id;
        const exists = document.getElementById(msgId);
        if (!exists) {
            ui.appendSingleMessage({ ...msg, chatId: msgChatId }, activeChatState.name, (await getAppUser()).id);
            ui.scrollToBottom();
        }
    }
    
    const chatIndex = getChats().findIndex(c => c.id === msgChatId);
    if (chatIndex !== -1) {
        const chat = getChats()[chatIndex];
        chat.lastMessage = msg.body || msg.text || 'Media message';
        chat.timestamp = msg.timestamp ? (msg.timestamp * 1000) : Date.now();
        
        if (!msg.fromMe && (!activeChatState || activeChatState.id !== msgChatId)) {
            chat.unreadCount = (chat.unreadCount || 0) + 1;
        }        
    }
}

async function selectChat(chat, isPopState = false, smoothScroll = true) {
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
    
    elements.appContainer.classList.remove('no-active-chat');
    
    if (window.innerWidth <= 768) {
        scrollToChat(smoothScroll);
    }
    
    if (!isPopState && window.location.hash !== `#chat-${chat.id}`) {
        window.location.hash = `chat-${chat.id}`;
    }
    
    try {
        const rawMessages = await getChatMessages(chat.id);
        const processedMessages = compensateMessageOrdering(rawMessages);
        ui.renderMessages(processedMessages, chat.name, (await getAppUser()).id, chat.id);
    } catch (error) {
        console.error('Failed to load messages:', error);
        elements.messagesContainer.innerHTML = '<div class="loading-chats">Error loading messages</div>';
    }
}

async function closeActiveChat(isPopState = false) {
    activeChatState = null;
    
    if (window.innerWidth <= 768) {
        scrollToList();
    } else {
        ui.toggleChatState(false);
    }

    
    if (!isPopState) {
        if (window.location.hash.startsWith('#chat-')) {
            history.back();
        }
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
    
    ui.appendSingleMessage(tempMsg, activeChatState.name, (await getAppUser()).id);
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
                tempBubble.id = normalizeId(responseData.id);
            }
            const meta = tempBubble.querySelector('.message-meta');
            meta.innerHTML = `<span>${formatTime(new Date())}</span><span style="width:14px; height:14px;" class="mif-done">`;
        }
        
        activeChatState.lastMessage = text;
        activeChatState.timestamp = new Date();
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
        const tempId = 'temp-' + Date.now();
        const tempMsg = {
            _data: {
                mimetype: file.type
            },
            id: tempId,
            body: "",
            fromMe: true,
            sender: 'me',
            timestamp: new Date().toISOString(),
            status: 'sending',
            hasMedia: true,
            media: {
                url: URL.createObjectURL(file),
                filename: file.name
            }
        };
        
        ui.appendSingleMessage(tempMsg, activeChatState.name, (await getAppUser()).id, activeChatState.id, true);
        ui.scrollToBottom();
        
        const result = await waha.sendFileMessage(activeChatState.id, file);
        ui.removeChatMessage(tempId);
        ui.appendSingleMessage(result.id, activeChatState.name, (await getAppUser()).id, activeChatState.id);
    } catch (error) {
        console.error(error.message);
    }
}

function saveSettings() {
    config.save(
        elements.inputWahaUrl.value,
        elements.inputSession.value,
        elements.inputApiKey.value
    );
    location.reload();
    loadChats();
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
