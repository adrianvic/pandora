if (localStorage.getItem('setupComplete') !== "true") window.location.href = "index.html";

import { config } from "./config";
import { waha } from "./waha";
import { ui, elements } from "./ui";
import { websocket } from "./websocket";
import { normalizeId, requireEl } from "./utils";
import { getAppUser, getChatPicture, getChats, getUser, getUserAbout, updateOnlineStatus } from "./storage";
import { upsertMessages } from "./db";
import type { Chat, Message, WebSocketEvent } from "./types";

// Elements
import { Sidebar } from "./element/Sidebar";
import { ScrollableView } from "./element/ScrollableView";
import { ChatPage } from "./element/ChatPage";
import { SettingsPage } from "./element/SettingsPage";
import { ProfilePage } from "./element/ProfilePage";

let sidebar: Sidebar;
let mainView: ScrollableView;
let chatPage: ChatPage;
let settingsPage: SettingsPage;

hydrate();

const messageTone = new Audio("./message.ogg");
const longPressEvent = new CustomEvent("longpress");
export let isLoadingChat = false;
export let notificationAuthorization: NotificationPermission = "default";

document.addEventListener('DOMContentLoaded', async () => {
    reloadTheme();
    ui.load(async () => {      
        ui.loadingMessage("Drawing sidebar...");
        updateSidebarPosition();
        ui.loadingMessage("Asking for notification permission...");
        askForNotificationPermission();
        ui.loadingMessage("Loading configuration...");
        if (chatPage.activeChatState) {
            chatPage.activeChatState.style.setProperty('--background-image', `URL("${config.bgImg}")`);
            chatPage.activeChatState.style.setProperty('--background-opacity', `${config.bgOpacity}`);
        }
        ui.loadingMessage("Getting server version...");
        await updateOnlineStatus();
        ui.loadingMessage("Setting up event listeners...");
        setupEventListeners();
        try {
            ui.loadingMessage("Replacing placeholders...");
            await setupElementsData();
            ui.loadingMessage("Loading chats...");
            await sidebar.loadChats(async (chat) => {
                window.location.hash = `#chat-${chat.id}`;
            });

            // Initial chat loading from hash
            const hash = window.location.hash;
            if (hash && hash.startsWith('#chat-')) {
                const chatId = hash.replace('#chat-', '');
                const chat = getChats().find(c => c.id === chatId);
                if (chat) {
                    selectChat(chat, true, false);
                }
            }
            ui.loadingMessage("Checking server status...");
            await checkWahaStatus();
            ui.loadingMessage("Telling server to send new messages...");
            initWebSocket();
        } catch {
            
        }
    })
});


function hydrate() {
    sidebar = new Sidebar(requireEl<HTMLElement>('.sidebar'), selectChat);
    mainView = new ScrollableView(requireEl<HTMLElement>('#main-view'));
    chatPage = new ChatPage(requireEl<HTMLElement>('.chat-area'));
    settingsPage = new SettingsPage(requireEl<HTMLElement>('#settings-page'));
    new ProfilePage(requireEl<HTMLElement>('#profile-page'));
}

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
    mainView.element.scrollTo({
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

    chatPage.element.addEventListener('archive-chat', (e) => {
        const detail = (e as CustomEvent).detail;
        if (detail.chatID && detail.archive !== undefined) sidebar.chatList.archiveChat(detail.chatID, detail.archive);
    })

    chatPage.element.addEventListener('message-dispatch', (e) => {
        const detail = (e as CustomEvent).detail;
        if (!detail.to.endsWith('@lid')) {
            sidebar.chatList.updateChatBadge(detail.to, 0);
            sidebar.chatList.updateItemFromMessage(detail.tempMsg);
        }
    });

    chatPage.element.addEventListener('mark-read', (e) => {
        const detail = (e as CustomEvent).detail;
        sidebar.chatList.updateChatBadge(detail.chatID, 0);
    });

    chatPage.element.addEventListener('back-click', () => {
        window.location.hash = '';
    });

    chatPage.element.addEventListener('chat-deleted', (e) => {
        const detail = (e as CustomEvent).detail;
        const chatItem = document.querySelector(`.chat-item[data-id='${detail.chatID}']`);
        chatItem?.remove();
    });

    settingsPage.element.addEventListener('theme-change', () => {
        reloadTheme();
    });
    
    elements.appContainer.addEventListener('scroll', () => {
        if (window.innerWidth > 768) return;
        if (isScrollingProgrammatically) return;
        
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const scrollLeft = elements.appContainer.scrollLeft;
            const width = elements.appContainer.clientWidth;
            
            if (scrollLeft < width * 0.2) {
                if (chatPage.messagesContainer) {
                    closeActiveChat(false);
                }
            }
        }, 100);
    });
    
    elements.appContainer.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            elements.desktopAside.after(sidebar.element);
        } else {
            mainView.element.insertBefore(sidebar.element, mainView.element.firstChild);
        }
    })
    
    document.addEventListener('keydown', (e) => {
        if (e.code == "Escape") {
            e.preventDefault();
            closeActiveChat(false);
        }
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
    
    elements.settingTheme.addEventListener('change', () => {
        const element = elements.settingTheme.querySelector('input[name="plan"]:checked') as HTMLInputElement;
        const value = element?.value ?? '';
        localStorage.setItem("pandora_theme", value);
        reloadTheme();
    })
}

function updateSidebarPosition() {                                                                                      
    if (!elements.desktopAside) return;
    
    if (window.innerWidth > 768) {                                                                                                                                                         
        if (sidebar.element.parentElement !== elements.appContainer) {
            elements.desktopAside.after(sidebar.element);
        }
    } else {
        if (sidebar.element.parentElement !== mainView.element) {
            mainView.element.insertBefore(sidebar.element, mainView.element.firstChild);
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


const lastNotificationTime = new Map<string, number>();

async function handleIncomingMessage(msg: Message) {
    if (!msg) return;
    
    sidebar.chatList.updateItemFromMessage(msg);
    
    const rawChatId = msg.chatId || (typeof msg.from === 'string' ? msg.from : (msg.from as any)?._serialized) || (msg.chat && msg.chat.id);
    const msgChatId = normalizeId(rawChatId);
    if (!msgChatId) {
        console.warn('[WS] Could not resolve chatId from payload:', msg);
        return;
    }
    
    if (!msg.fromMe) {
        // Only play tone if it's not the active chat
        if (chatPage.messagesContainer?.chatID !== msgChatId) {
            messageTone.play();
        }

        // Browser notification only if app is NOT focused
        if (!document.hasFocus() && notificationAuthorization === "granted") {
            const now = Date.now();
            const lastTime = lastNotificationTime.get(msgChatId) || 0;

            // 5 second cooldown per sender
            if (now - lastTime > 5000) {
                new Notification("New message", { body: msg.body || msg.text });
                lastNotificationTime.set(msgChatId, now);
            }
        }
    }
    
    if (chatPage.messagesContainer?.chatID === msgChatId) {
        const msgId = normalizeId(msg.id as any) || (msg.id as string);
        const exists = chatPage.messagesContainer.getMessage(msgId);
        if (!exists) {
            const containerEl = chatPage.messagesContainer.element;
            const scrolled = containerEl.scrollTop === (containerEl.scrollHeight - containerEl.clientHeight);
            chatPage.messagesContainer.appendMessage({ ...msg, chatId: msgChatId });
            if (!scrolled && window.innerWidth > 768) {
                ui.scrollToBottom(containerEl);
            }
        }
    }
}

async function selectChat(chat: Chat, _isPopState = false, smoothScroll = true) {
    chatPage.element.scrollIntoView({
        behavior: "smooth"
    });
    if (isLoadingChat) return;
    // if (chatPage.messagesContainer?.chatID === chat.id) return;

    isLoadingChat = true;
    mainView?.scrollTo(chatPage.element);
    chatPage.loadChat(chat, (await getAppUser()).id);

    
    if (window.innerWidth <= 768) {
        scrollToChat(smoothScroll);
    }
    
    isLoadingChat = false;
}

async function closeActiveChat(_isPopState = false, forceClose = false) {
    if (window.innerWidth <= 768) {
        scrollToList(true);
    } else {
        chatPage.closeChat(forceClose);
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

export function reloadTheme() {
    const body = document.querySelector('body');
    const loadedTheme = localStorage.getItem('pandora_theme') ?? '';
    if (body) body.classList = loadedTheme;
    const loadedThemeEl = elements.settingTheme.querySelector(`input[value="${loadedTheme}"]`) as HTMLInputElement;
    if (loadedThemeEl) loadedThemeEl.checked = true;
}