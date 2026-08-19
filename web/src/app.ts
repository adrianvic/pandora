import { config } from "./config";
import { waha } from "./waha";
import { ui, elements, views } from "./ui";
import { websocket } from "./websocket";
import { compensateMessageOrdering, debounce, formatTime, normalizeId } from "./utils";
import { fetchChats, getAppUser, getChatMessages, getChatPicture, getChats, getGroupUsers, getUser, getUserAbout, getUsersFromGroup, markRead, sendStatus, updateOnlineStatus } from "./storage";
import { deleteDatabase, upsertMessages } from "./db";
import { showNotification } from "./notification";
import type { Chat, Message, WebSocketEvent } from "./types";
import { activeChatState, clearMentionCache, clearMentionedContacts, getMentionedIDs, mentionCacheID, mentionCacheText, mentionedContact, mentionedContacts, removeMentionedContact, setActiveChatState } from "./states";
if (localStorage.getItem('setupComplete') !== "true") window.location.href = "index.html";

const messageTone = new Audio("./message.ogg");
const longPressEvent = new CustomEvent("longpress");
export let isLoadingChat = false;
export let notificationAuthorization: NotificationPermission = "default";
const mainViewEl = document.getElementById("main-view");
if (!mainViewEl) throw console.error();
const mainView = views.get(mainViewEl);

document.addEventListener('DOMContentLoaded', async () => {
    ui.load(async () => {      
        ui.loadingMessage("Drawing sidebar...");
        updateSidebarPosition();
        ui.loadingMessage("Asking for notification permission...");
        askForNotificationPermission();
        ui.loadingMessage("Loading configuration...");
        if (elements.inputApiKey) elements.inputApiKey.value = config.apiKey;
        if (elements.inputWahaUrl) elements.inputWahaUrl.value = config.wahaUrl;
        if (elements.inputSession) elements.inputSession.value = config.session;
        if (elements.inputBackgroundImage) elements.inputBackgroundImage.value = config.bgImg;
        if (elements.inputBackgroundOpacity) elements.inputBackgroundOpacity.value = config.bgOpacity;
        if (elements.activeChatContainer) {
            elements.activeChatContainer.style.setProperty('--background-image', `URL("${config.bgImg}")`);
            elements.activeChatContainer.style.setProperty('--background-opacity', `${config.bgOpacity}`);
        }
        ui.loadingMessage("Getting server version...");
        await updateOnlineStatus();
        ui.loadingMessage("Setting up event listeners...");
        setupEventListeners();
        try {
            ui.loadingMessage("Replacing placeholders...");
            await setupElementsData();
            ui.loadingMessage("Loading chats...");
            await loadChats();
            ui.loadingMessage("Checking server status...");
            await checkWahaStatus();
            ui.loadingMessage("Telling server to send new messages...");
            await initWebSocket();
        } finally {
            elements.chatsLoader.classList.add('hidden');
        }
    })
});


async function askForNotificationPermission() {
    notificationAuthorization = await Notification.requestPermission();
}

async function setupElementsData() {
    try {
        const usr = await getAppUser();
        const usrPic = (await getChatPicture(usr.id))?.url;
        const usrInfo = await getUser(usr.id);
        const usrAbout = (await getUserAbout(usr.id))?.about;
        elements.contentUserName.forEach(e => {
            e.innerHTML = usr.pushName || usr.name || '';
        })
        elements.contentUserNumber.forEach(async e => {
            if (usrInfo) e.innerHTML = usrInfo.number;
        })
        elements.resourceUserPic.forEach(async e => {
            if (usrPic) e.src = usrPic;
        })
        elements.valueUserStatus.forEach(async e => {
            if (usrAbout) e.value = usrAbout.trim();
        })
    } catch (error: any) {
        console.error(error.message);
    }
}

function purgeDatabase(ask: boolean = true) {
    if (ask) {
        if (!(confirm("Are you sure you want to delete all cached messages?") && confirm("This cannot be undone. Proceed?"))) return;
    }
    localStorage.clear();
    deleteDatabase();
    location.reload();
}

function loadChats() {
    elements.chatsLoader.classList.remove('hidden');
    try {
        fetchChats().then(async () => {
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
    } catch (error: any) {
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
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

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
    mainViewEl?.scrollTo({
        left: 0,
        behavior: smooth ? 'smooth' : 'auto'
    });
    setTimeout(() => { isScrollingProgrammatically = false; }, smooth ? 400 : 50);
}

function setupEventListeners() {
    window.addEventListener('resize', updateSidebarPosition);
    
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
        
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const scrollLeft = elements.appContainer.scrollLeft;
            const width = elements.appContainer.clientWidth;
            
            if (scrollLeft < width * 0.2) {
                if (activeChatState) {
                    closeActiveChat(false);
                }
            }
        }, 100);
    });
    
    elements.appContainer.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            elements.desktopAside.after(elements.sidebar);
        } else {
            mainViewEl?.insertBefore(elements.sidebar, mainViewEl.firstChild);
        }
    })
    
    document.addEventListener('keydown', (e) => {
        if (e.code == "Escape") {
            e.preventDefault();
            closeActiveChat(false);
        }
    });
    
    elements.chatSearch.addEventListener('input', (e: Event) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        const filtered = getChats().filter(chat =>
            chat.name.toLowerCase().includes(query)
        );
        ui.renderChatList(filtered, activeChatState, selectChat);
    });
    
    ui.autoResizeTextArea(elements.messageInput);
    
    elements.messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });
    
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    elements.messageInput.addEventListener('input', (e) => {
        const inputEvent = e as InputEvent;
        
        mentionedContacts.forEach(c => {
            if (!elements.messageInput.value.includes(`@${c.number}`)) {
                removeMentionedContact(c);
            }
        })
        
        if (inputEvent.data === "@") {
            suggestMention();
        } else {
            elements.mentioningSuggestion.classList.add('collapsed');
        }
    });
    
    elements.chatBottomBar.style.height = `${elements.chatInputPanel.offsetHeight}px`;
    const observer = new ResizeObserver(() => {
        elements.chatBottomBar.style.height =
        `${elements.chatInputPanel.offsetHeight}px`;
    });
    
    elements.mentioningIndicator.addEventListener('click', clearMentionCache);
    
    observer.observe(elements.chatInputPanel);
    elements.chatBottomBarBtn.addEventListener('click', ui.toggleChatBottomBar);
    elements.chatBottomBar.addEventListener('click', (e) => {
        if (e.target == e.currentTarget) ui.toggleChatBottomBar();
    });
    
    elements.markreadBtn.addEventListener('click', async () => {
        if (activeChatState) {
            const result = await markRead(activeChatState.id);
            if (result) ui.updateChatInChatList2(result);
        }
    });
    
    elements.attachmentBtn.addEventListener('click', () => {
        elements.attachmentInput.click();
    });
    elements.attachmentInput.addEventListener('change', function (this: HTMLInputElement) {
        const firstFile = this.files?.[0];
        if (firstFile) sendFileMessage(firstFile);
    });
    
    elements.mentionBtn.addEventListener('click', async () => {
        suggestMention();
        ui.toggleChatBottomBar();
    });
    
    elements.backToSidebarBtn.addEventListener('click', () => {
        closeActiveChat(false);
    });
    
    elements.desktopSidebarButtons.forEach(sidebarBtn => {
        sidebarBtn.addEventListener('click', () => {
            const page = sidebarBtn.dataset.page;
            if (!page) return;
            const pageEl = document.getElementById(page);
            if (!pageEl) return;
            if (page) mainView?.scrollTo(pageEl);
        })
    })
    
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    
    elements.purgeDatabaseButton.addEventListener('click', () => purgeDatabase(true));
    
    elements.inputUserStatus.addEventListener('input', debounce(async function() {
        const result = await sendStatus(elements.inputUserStatus.value);
        if (result?.success) {
            showNotification("Status updated successfully!", "", 2000);
        } else {
            showNotification("Failed to update status...", "", 2000);
        }
    }, 2000))
    
    elements.selectable.forEach(e => {
        let timerId: ReturnType<typeof setTimeout>, longPressed: boolean;
        
        e.addEventListener('mousedown', () => {
            longPressed = false;
            
            timerId = setTimeout(() => {
                longPressed = true;
                e.dispatchEvent(longPressEvent);
            }, 500); // 500ms for long press
        })
        
        e.addEventListener('click', (event) => {
            if (longPressed) {
                event.preventDefault();
                clearTimeout(timerId);
            }
        })
        
        e.addEventListener('mouseleave', () => {
            clearTimeout(timerId);
        })
    })
}

function updateSidebarPosition() {                                                                                      
    if (!mainViewEl || !elements.sidebar || !elements.desktopAside) return;
    
    if (window.innerWidth > 768) {                                                                                                                                                         
        if (elements.sidebar.parentElement !== elements.appContainer) {
            elements.desktopAside.after(elements.sidebar);
        }
    } else {
        if (elements.sidebar.parentElement !== mainViewEl) {
            mainViewEl.insertBefore(elements.sidebar, mainViewEl.firstChild);
        }
    }
}

function initWebSocket() {
    websocket.connect((data: WebSocketEvent) => {
        const ev = data.event;
        if (ev === 'message' || ev === 'message.any' || ev === 'message.ack') {
            handleIncomingMessage(data.payload);
            upsertMessages([data.payload]);
        }
    });
}


async function handleIncomingMessage(msg: Message) {
    if (!msg) return;
    
    ui.updateChatInChatList(msg);
    
    const rawChatId = msg.chatId || (typeof msg.from === 'string' ? msg.from : (msg.from as any)?._serialized) || (msg.chat && msg.chat.id);
    const msgChatId = normalizeId(rawChatId);
    if (!msgChatId) {
        console.warn('[WS] Could not resolve chatId from payload:', msg);
        return;
    }
    
    if (!msg.fromMe) {
        messageTone.play();
        if (notificationAuthorization === "granted") {
            new Notification("New message", { body: msg.body || msg.text });
        }
    }
    
    if (activeChatState && activeChatState.id === msgChatId) {
        const msgId = normalizeId(msg.id as any) || (msg.id as string);
        const exists = document.getElementById(msgId);
        if (!exists) {
            const container = elements.messagesContainer;
            const scrolled = container.scrollTop === (container.scrollHeight - container.clientHeight);
            ui.appendSingleMessage({ ...msg, chatId: msgChatId }, activeChatState.name, (await getAppUser()).id);
            if (scrolled && window.innerWidth > 768) {
                ui.scrollToBottom();
            }
        }
    }
}

async function selectChat(chat: Chat, isPopState = false, smoothScroll = true) {
    if (isLoadingChat) return;
    
    clearMentionCache();
    clearMentionedContacts();
    elements.mentioningSuggestion.classList.add('collapsed');
    
    const pageEl = document.getElementById("chat-page");
    if (!pageEl) return;
    mainView?.scrollTo(pageEl);
    
    isLoadingChat = true;
    setActiveChatState(chat);
    
    chat.unreadCount = 0;
    
    ui.toggleChatState(true);
    elements.activeChatName.textContent = chat.name.toUpperCase();
    elements.activeChatAvatar.textContent = chat.name ? chat.name.substring(0, 1).toUpperCase() : '?';
    
    elements.messagesContainer.innerHTML = `
    <div class='loading-animation-wrapper'>
        <div class="animation">
            <p class="animation"></p>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    </div>`;
    
    elements.appContainer.classList.remove('no-active-chat');
    
    if (window.innerWidth <= 768) {
        scrollToChat(smoothScroll);
    }
    
    if (!isPopState && window.location.hash !== `#chat-${chat.id}`) {
        window.location.hash = ``;
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
    
    isLoadingChat = false;
}

async function closeActiveChat(isPopState = false) {
    setActiveChatState(null);
    
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
    const _mentionCacheID = mentionCacheID;
    const _mentionCacheText = mentionCacheText;
    clearMentionCache();
    clearMentionedContacts();
    
    elements.messageInput.value = '';
    elements.messageInput.dispatchEvent(new Event("input", { bubbles: true }));
    
    const tempMsg = {
        id: 'temp-' + Date.now(),
        body: text,
        fromMe: true,
        sender: 'me',
        timestamp: new Date().toISOString(),
        status: 'sending',
        replyTo: _mentionCacheID ? {
            body: _mentionCacheText || "Mention (no text)"
        } : null
    } as any;
    
    ui.appendSingleMessage(tempMsg, activeChatState.name, (await getAppUser()).id);
    ui.scrollToBottom();
    
    try {
        try {
            if (!activeChatState.id.endsWith('@lid')) {
                await waha.readChat(activeChatState.id);
            }
        } catch (e: any) {
            console.warn('readChat failed (non-fatal):', e.message);
        }
        
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
        
        const responseData = await waha.sendTextMessage(activeChatState.id, text, getMentionedIDs(), _mentionCacheID);
        
        const tempBubble = document.getElementById(tempMsg.id);
        if (tempBubble) {
            if (responseData && responseData.id) {
                tempBubble.id = normalizeId(responseData.id as any) || tempBubble.id;
            }
            const meta = tempBubble.querySelector('.message-meta');
            if (meta) meta.innerHTML = `<span>${formatTime(new Date())}</span><span style="width:14px; height:14px;" class="mif-done">`;
        }
        
        activeChatState.lastMessage = text;
        activeChatState.timestamp = new Date().toISOString();
    } catch (error) {
        console.error('Failed to send message:', error);
        const tempBubble = document.getElementById(tempMsg.id);
        if (tempBubble) {
            const meta = tempBubble.querySelector('.message-meta');
            if (meta) meta.innerHTML = `<span style="color: #ef4444;">Failed to send</span>`;
        }
    }
}

async function sendFileMessage(file: File) {
    if (!activeChatState) return;
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
        } as any;
        
        ui.appendSingleMessage(tempMsg, activeChatState.name, (await getAppUser()).id, true);
        ui.scrollToBottom();
        
        const result = await waha.sendFileMessage(activeChatState.id, file);
        ui.removeChatMessage(tempId);
        ui.appendSingleMessage(result, activeChatState.name, (await getAppUser()).id);
    } catch (error: any) {
        console.error(error.message);
    }
}

function saveSettings() {
    config.save(
        elements.inputWahaUrl.value,
        elements.inputSession.value,
        elements.inputApiKey.value,
        elements.inputBackgroundImage.value,
        elements.inputBackgroundOpacity.value
    );
    location.reload();
    loadChats();
    checkWahaStatus();
    initWebSocket();
}

async function suggestMention() {
    elements.mentionSuggestions.innerHTML = "";
    elements.mentioningSuggestion.classList.remove("collapsed");
    elements.mentioningSuggestion.classList.add("loading");
    
    try {
        // if (!activeChatState?.id.endsWith("@g.us")) {
        //     elements.mentioningSuggestion.innerHTML = "<p>Cannot mention outside groups.</p>"
        //     return
        // };

        if (!activeChatState) throw Error;
        
        const gpUsrs = await getGroupUsers(activeChatState.id);
        if (!gpUsrs) return;
        
        const usrs = await getUsersFromGroup(gpUsrs);
        if (!usrs) return;
        
        usrs.forEach(u => {
            if (!u) return;
            
            const name = u.name ?? u.pushname;
            if (!name) return;
            
            const contact = document.createElement("div");
            contact.classList.add("mention-suggestion");
            contact.innerText = name;
            
            contact.addEventListener("click", () => {
                mentionedContact(u);
                
                elements.messageInput.value =
                elements.messageInput.value.slice(0, -1) + `@${u.number} `;
                
                elements.messageInput.dispatchEvent(
                    new Event("input", { bubbles: true })
                );
                
                elements.mentioningSuggestion.classList.add("collapsed");
                elements.messageInput.focus();
            });
            
            elements.mentionSuggestions.appendChild(contact);
        });
        
    } catch (error) {
        elements.mentionSuggestions.innerHTML = "<p>No user was found.</p>";
        
    } finally {
        elements.mentioningSuggestion.classList.remove("loading");
    }
}

async function checkWahaStatus() {
    try {
        const data = await waha.getVersion();
        ui.updateConnectionStatus(true, `WAHA Connected: v${data.version || 'OK'}`);
    } catch (e) {
        ui.updateConnectionStatus(false, 'WAHA Server Offline');
    }
}

export function getCurrentChat() {
    return activeChatState;
}