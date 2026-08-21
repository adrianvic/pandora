if (localStorage.getItem('setupComplete') !== "true") window.location.href = "index.html";

import { config } from "./config";
import { waha } from "./waha";
import { ui, elements } from "./ui";
import { websocket } from "./websocket";
import { debounce, normalizeId, requireEl } from "./utils";
import { deleteChat, getAppUser, getChatPicture, getChats, getUser, getUserAbout, markRead, sendStatus, updateOnlineStatus } from "./storage";
import { deleteDatabase, upsertMessages } from "./db";
import { showNotification } from "./notification";
import type { Chat, Message, WebSocketEvent } from "./types";

// Elements
import { Sidebar } from "./element/Sidebar";
import { ScrollableView } from "./element/ScrollableView";
import { ChatPage } from "./element/ChatPage";

let sidebar: Sidebar;
let mainView: ScrollableView;
let chatPage: ChatPage;

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
            await sidebar.loadChats(async (chat) => {
                chatPage.loadChat(chat, (await getAppUser()).id);
            });
            ui.loadingMessage("Checking server status...");
            await checkWahaStatus();
            ui.loadingMessage("Telling server to send new messages...");
            initWebSocket();
        } finally {
            elements.chatsLoader.classList.add('hidden');
        }
    })
});


function hydrate() {
    sidebar = new Sidebar(requireEl<HTMLElement>('.sidebar'));
    mainView = new ScrollableView(requireEl<HTMLElement>('#main-view'));
    chatPage = new ChatPage(requireEl<HTMLElement>('.chat-area'));
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

function purgeDatabase(ask: boolean = true) {
    if (ask) {
        if (!(confirm("Are you sure you want to delete all cached messages?") && confirm("This cannot be undone. Proceed?"))) return;
    }
    localStorage.clear();
    deleteDatabase();
    location.reload();
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

    // update sidebar when sending message
    chatPage.element.addEventListener('message-dispatch', (e) => {
        const cev = e as CustomEvent;

        if (!cev.detail.to.endsWith('@lid')) {
            sidebar.chatList.updateChatBadge(cev.detail.to, 0);
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
    
    elements.chatSearch.addEventListener('input', (e: Event) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        const filtered = getChats().filter(chat =>
            chat.name.toLowerCase().includes(query)
        );
        sidebar.chatList.renderChatList(filtered, selectChat);
    });
    
    elements.markreadBtn.addEventListener('click', async () => {
        if (chatPage.messagesContainer) {
            await markRead(chatPage.messagesContainer.chatID);
            sidebar.chatList.updateChatBadge(chatPage.messagesContainer?.chatID, 0);
        }
    });
    
    elements.clearChatBtn.addEventListener('click', () => {
        if (!chatPage.messagesContainer) return;
        if (confirm('Do you want to delete this chat?')) {
            const chat = document.querySelector(`.chat-item[data-foo='${chatPage.messagesContainer?.chatID}']`)
            chat?.remove();
            deleteChat(chatPage.messagesContainer?.chatID);
            closeActiveChat();
        }
    });
    
    elements.attachmentBtn.addEventListener('click', () => {
        elements.attachmentInput.click();
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
        messageTone.play();
        if (notificationAuthorization === "granted") {
            new Notification("New message", { body: msg.body || msg.text });
        }
    }
    
    if (chatPage.messagesContainer?.chatID === msgChatId) {
        const msgId = normalizeId(msg.id as any) || (msg.id as string);
        const exists = chatPage.messagesContainer.getMessage(msgId);
        if (!exists) {
            const container = elements.messagesContainer;
            const scrolled = container.scrollTop === (container.scrollHeight - container.clientHeight);
            chatPage.messagesContainer?.appendMessage({ ...msg, chatId: msgChatId });
            if (scrolled && window.innerWidth > 768 && chatPage.messagesContainer) {
                ui.scrollToBottom(chatPage.messagesContainer.element);
            }
        }
    }
}

async function selectChat(chat: Chat, isPopState = false, smoothScroll = true) {
    if (isLoadingChat) return;
    
    const messagesContainer = chatPage.loadChat(chat, (await getAppUser()).id);

    mainView?.scrollTo(messagesContainer.element);
    
    // elements.messagesContainer.innerHTML = `
    // <div class='loading-animation-wrapper'>
    //     <div class="animation">
    //         <p class="animation"></p>
    //         <div class="dot"></div>
    //         <div class="dot"></div>
    //         <div class="dot"></div>
    //         <div class="dot"></div>
    //         <div class="dot"></div>
    //     </div>
    // </div>`;
    
    if (window.innerWidth <= 768) {
        scrollToChat(smoothScroll);
    }
    
    if (!isPopState && window.location.hash !== `#chat-${chat.id}`) {
        window.location.hash = ``;
        window.location.hash = `chat-${chat.id}`;
    }
}

async function closeActiveChat(isPopState = false, forceClose = false) {
    if (window.innerWidth <= 768) {
        scrollToList(true);
    } else {
        chatPage.closeChat(forceClose);
    }
    
    if (!isPopState) {
        if (window.location.hash.startsWith('#chat-')) {
            history.back();
        }
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