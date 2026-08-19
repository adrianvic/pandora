import { formatTime, normalizeId } from "./utils";
import { getChatPicture, getMessage, getMedia, getMoreChatMessages } from "./storage";
import type { Chat, Message } from "./types";
import { activeChatState, prepareMention } from "./states";
import { Parser } from "./parser";

export const elements = {
    chatList: document.getElementById('chat-list') as HTMLUListElement,
    chatsLoader: document.getElementById('chats-loader') as HTMLDivElement,
    chatSearch: document.getElementById('chat-search') as HTMLInputElement,
    backendStatusText: document.getElementById('backend-status-text') as HTMLSpanElement,
    apiStatusIndicator: document.querySelector('.pulse-dot') as HTMLSpanElement,
    noChatState: document.getElementById('no-chat-state') as HTMLDivElement,
    activeChatContainer: document.getElementById('active-chat-container') as HTMLDivElement,
    activeChatName: document.getElementById('active-chat-name') as HTMLHeadingElement,
    activeChatAvatar: document.getElementById('active-chat-avatar') as HTMLDivElement,
    messagesContainer: document.getElementById('messages-container') as HTMLDivElement,
    messageForm: document.getElementById('message-form') as HTMLFormElement,
    messageInput: document.getElementById('message-input') as HTMLTextAreaElement,
    backToSidebarBtn: document.querySelector('.chat-header') as HTMLElement,
    sidebar: document.querySelector('.sidebar') as HTMLElement,
    appContainer: document.querySelector('.app-container') as HTMLElement,
    settingsModal: document.getElementById('settings-page') as HTMLElement,
    settingsIconBtn: document.getElementById('settings-sidebar-btn') as HTMLButtonElement,
    saveSettingsBtn: document.getElementById('save-settings') as HTMLButtonElement,
    purgeDatabaseButton: document.getElementById('purge-database') as HTMLButtonElement,
    inputWahaUrl: document.getElementById('settings-waha-url') as HTMLInputElement,
    inputSession: document.getElementById('settings-session') as HTMLInputElement,
    inputApiKey: document.getElementById('settings-api-key') as HTMLInputElement,
    inputBackgroundImage: document.getElementById('settings-background-image') as HTMLInputElement,
    inputBackgroundOpacity: document.getElementById('settings-background-opacity') as HTMLInputElement,
    loggedUserName: document.getElementById('pandora-username') as HTMLHeadingElement,
    chatBottomBar: document.getElementById('chat-bottom-bar') as HTMLElement,
    chatBottomBarBtn: document.getElementById('chat-bottom-bar-btn') as HTMLButtonElement,
    chatInputPanel: document.getElementById('chat-input-panel') as HTMLElement,
    attachmentInput: document.getElementById('attachment-input') as HTMLInputElement,
    attachmentBtn: document.getElementById('attachment-btn') as HTMLButtonElement,
    mentionBtn: document.getElementById('mention-btn') as HTMLButtonElement,
    markreadBtn: document.getElementById('markread-btn') as HTMLButtonElement,
    extraPages: document.querySelectorAll('.extra-page') as NodeListOf<HTMLElement>,
    desktopSidebarButtons: document.querySelectorAll("#desktop-aside button") as NodeListOf<HTMLButtonElement>,
    desktopAside: document.getElementById('desktop-aside') as HTMLElement,
    contentUserName: document.querySelectorAll('[data-content="app-user"]') as NodeListOf<HTMLElement>,
    contentUserNumber: document.querySelectorAll('[data-content="app-user-number"]') as NodeListOf<HTMLElement>,
    resourceUserPic: document.querySelectorAll('[data-resource="app-user-image"]') as NodeListOf<HTMLImageElement>,
    valueUserStatus: document.querySelectorAll('[data-value="app-user-status"]') as NodeListOf<HTMLInputElement>,
    inputUserStatus: document.getElementById('profile-page-status-input') as HTMLInputElement,
    selectable: document.querySelectorAll('.selectable') as NodeListOf<HTMLElement>,
    nextPageButtons: document.querySelectorAll('.next-page-btn') as NodeListOf<HTMLElement>,
    scrollableViews: document.querySelectorAll('._scrollableView') as NodeListOf<HTMLElement>,
    loadingScreen: document.querySelector('#loading-screen') as HTMLElement,
    loadingScreenStatus: document.querySelector('#loading-screen-status') as HTMLElement,
    mentioningIndicator: document.querySelector('#mentioning-indicator') as HTMLElement,
    mentioningSuggestion: document.querySelector('#mentioning-suggestion') as HTMLElement,
    mentionSuggestions: document.querySelector('#mention-suggestions') as HTMLElement,
    settingTheme: document.querySelector('#settings-theme') as HTMLFieldSetElement
};

export const views = new Map<HTMLElement, ScrollableView>;

export const ui = {
    /**
    * Switch view state when a contact chat is opened or closed
    */
    toggleChatState(hasActive: boolean) {
        if (hasActive) {
            elements.noChatState.classList.add('hidden');
            elements.activeChatContainer.classList.remove('hidden');
        } else {
            elements.noChatState.classList.remove('hidden');
            elements.activeChatContainer.classList.add('hidden');
        }
    },
    
    /**
    * Scroll message list automatically to bottom
    */
    scrollToBottom() {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
            });
        });
    },
    
    ensureScroll(container: HTMLElement, after: Function) {
        const scrolled = container.scrollTop === (container.scrollHeight - container.clientHeight);
        after();
        if (scrolled) {
            container.scrollTop = container.scrollHeight;
        }
    },
    
    /**
    * Update connection status badge in sidebar footer
    */
    updateConnectionStatus(isConnected: boolean, text: string) {
        elements.backendStatusText.textContent = text;
        if (isConnected) {
            elements.apiStatusIndicator.style.backgroundColor = 'var(--online-color)';
            elements.apiStatusIndicator.style.animation = 'pulse 1.8s infinite';
        } else {
            elements.apiStatusIndicator.style.backgroundColor = '#ef4444';
            elements.apiStatusIndicator.style.animation = 'none';
        }
    },
    
    async renderChatList(chats: Chat[], activeChat: Chat | null, onChatSelect: (chat: Chat) => void) {
        elements.chatList.innerHTML = '';
        chats.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
        });
        
        if (chats.length === 0) {
            elements.chatList.innerHTML = `<li class="loading-chats">No chats found</li>`;
            return;
        }
        
        for (const chat of chats) {
            if (chat.timestamp == null) return;
            const li = document.createElement('li');
            li.className = `chat-item selectable ${activeChat && activeChat.id === chat.id ? 'active' : ''}`;
            li.dataset.id = chat.id;
            
            const initials = chat.name ? chat.name.substring(0, 1).toUpperCase() : '?';
            const hasUnread = chat.unreadCount && chat.unreadCount > 0;
            const timeStr = formatTime(chat.timestamp || new Date());
            
            li.innerHTML = `
      <div class="avatar">
        <img
          src=""
          alt="${initials}"
          data-chat-avatar="${chat.id}"
        />
      </div>
      <div class="chat-item-info">
        <div class="chat-item-meta">
          <span class="chat-item-name">${chat.name}</span>
          <span class="chat-item-time">${timeStr}</span>
        </div>
        <div class="chat-item-preview">
          <span class="chat-item-msg${chat.lastMessage == null ? ' text-accent' : ''}" data-chatid="${chat.id}">
            ${chat.lastMessage || '...'}
          </span>
          ${hasUnread ? `<span class="unread-badge">${chat.unreadCount}</span>` : ''}
        </div>
      </div>
    `;
            
            li.addEventListener('click', () => onChatSelect(chat));
            elements.chatList.appendChild(li);
            
            (async () => {
                try {
                    const picture = await getChatPicture(chat.id);
                    const img = li.querySelector(`img[data-chat-avatar="${chat.id}"]`) as HTMLImageElement;
                    if (img) img.src = picture.url ? picture.url : '';
                } catch (e) {
                }
            })();
        }
    },
    
    async updateChatInChatList(msg: Message) {
        const chatNode = document.querySelector(`.chat-item[data-id="${msg.fromMe ? msg.to : msg.from}"]`) as HTMLElement;
        
        if (chatNode) {
            const messageItem = chatNode.querySelector('.chat-item-msg') as HTMLElement;
            const time = chatNode.querySelector('.chat-item-time') as HTMLElement;
            messageItem.innerText = msg.body || msg.text || 'Media message';
            time.innerText = msg.timestamp ? formatTime(msg.timestamp) : formatTime(Date.now());
            
            if (!msg.fromMe && (!activeChatState || activeChatState.id !== (msg.fromMe ? msg.to : msg.from))) {
                const unreadBadge = chatNode.querySelector('.unread-badge') as HTMLElement;
                if (unreadBadge) {
                    unreadBadge.innerText = (Number(unreadBadge.innerHTML) || 0) + 1 + "";
                } else {
                    const preview = chatNode.querySelector('.chat-item-preview') as HTMLElement;
                    const badge = document.createElement('span');
                    badge.className = 'unread-badge';
                    badge.innerText = '1';
                    preview.appendChild(badge);
                }
            }
        }
    },
    
    async updateChatInChatList2(chat: Chat) {
        const chatNode = document.querySelector(`.chat-item[data-id="${chat.id}"]`) as HTMLElement;
        
        if (chatNode) {
            const messageItem = chatNode.querySelector('.chat-item-msg') as HTMLElement;
            const time = chatNode.querySelector('.chat-item-time') as HTMLElement;
            messageItem.innerText = chat.lastMessage || 'Media message';
            time.innerText = chat.timestamp ? formatTime(chat.timestamp) : formatTime(Date.now());
            const unreadBadge = chatNode.querySelector('.unread-badge') as HTMLElement;
            const newCount = (Number(unreadBadge?.innerHTML) || 0);
            if (unreadBadge && newCount != 0) {
                unreadBadge.innerText = newCount + "";
            } else {
                if (unreadBadge) unreadBadge.remove();
            }
        }
    },
    
    /**
    * Render chat message log inside chat view container
    */
    async renderMessages(messages: Message[], _activeChatName: string, userID: string, chatId: string) {
        elements.messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            elements.messagesContainer.innerHTML = '<div class="loading-chats">No messages. Say hello!</div>';
            return;
        }
        
        const loadMore = document.createElement("button");
        loadMore.classList.add("load-more-btn");
        loadMore.innerText = "Load more";
        loadMore.onclick = () => {
            this.loadMoreMessages(chatId, userID);
        };
        elements.messagesContainer.appendChild(loadMore);
        
        for (const msg of messages) {
            this.appendSingleMessage(msg, userID, chatId);
        }
        
        this.scrollToBottom();
    },
    
    async loadMoreMessages(chatId: string, userId: string) {
        const oldest = document.querySelector('.message-group:first-of-type') as HTMLElement;
        if (!oldest) return;
        const oldestTimestamp = oldest.dataset.timestamp;
        const oldestId = oldest.id;
        
        const loadMoreButton = document.querySelector('.load-more-btn') as HTMLButtonElement;
        
        const msgs = await getMoreChatMessages(chatId, oldestTimestamp, oldestId);
        // JS version had msgs.shift(), probably to avoid duplication of the oldest message
        msgs.shift();
        
        msgs.forEach(async msg => {
            const message = this.generateMessage(msg, userId, chatId);
            if (message) {
                loadMoreButton.after();
            }
        });
    },
    
    /**
    * Append a single message (used for optimistic updates immediately upon sending)
    */
    appendSingleMessage(msg: Message, userID: string, chatId: string, isLocal: boolean = false) {
        const message = this.generateMessage(msg, userID, chatId, isLocal);
        if (message) {
            elements.messagesContainer.appendChild(message)
        }
    },
    
    generateTempMessageLink(msg: Message) {
        const a = document.createElement('a');
        a.target = "_blank";
        if (msg.media) {
            a.href = msg.media.url;
            
            if (msg._data?.mimetype?.startsWith('image/')) {
                const img = document.createElement('img');
                img.classList.add('message-image-attachement');
                img.src = msg.media.url;
                a.appendChild(img);
            } else {
                a.textContent = msg.media.filename || "Download file";
                a.download = msg.media.filename || "file";
            }
        }
        
        return a;
    },
    
    generateMessage(msg: Message, userID: string, chatId: string, isLocal: boolean = false) {
        if (msg._data && msg._data.type == "gp2") return; // probably group description edit
        const isOutgoing = msg.fromMe || msg.sender === 'me';
        
        function getPrevMessageElem() {
            return elements.messagesContainer.lastElementChild as HTMLElement | null;
        }
        
        const prevMsgEl = getPrevMessageElem();
        
        const groupDiv = document.createElement('div');
        groupDiv.className = `message-group selectable ${isOutgoing ? 'outgoing' : 'incoming'}`;
        groupDiv.id = normalizeId(msg._serialized ? (msg._serialized as any) : msg.id) || "msg-id";
        groupDiv.dataset.id = msg.id.toString();
        groupDiv.dataset.timestamp = msg.timestamp?.toString();
        groupDiv.dataset.from = msg.participant || (msg.from as string);
        
        const senderName = isOutgoing ? userID : (msg._data?.notifyName || (msg.from as string));
        const timeStr = formatTime(msg.timestamp || new Date());
        
        let statusCheck = '';
        if (isOutgoing) {
            if (msg.status === 'read') {
                statusCheck = '<span class="mif-done_all" style="color: var(--online-color); width:14px; height:14px;"></span>';
            } else if (msg.status === 'delivered') {
                statusCheck = '<span class="mif-done" style="width:14px; height:14px;"></span>';
            } else if (msg.status === 'sending') {
                statusCheck = '<span class="mif-earth" style="width:14px; height:14px;"></span>';
            } else {
                statusCheck = '<span class="mif-done" style="width:14px; height:14px;"></span>';
            }
        }
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        let prevUid: string | undefined;
        
        if (msg.participant) {
            prevUid = msg.participant;
        } else {
            prevUid = msg.from as string;
        }
        
        if (!isOutgoing && (!prevMsgEl || prevUid !== prevMsgEl.dataset.from)) {
            const senderEl = document.createElement('span');
            senderEl.className = 'message-sender';
            senderEl.textContent = senderName;
            bubble.appendChild(senderEl);
        }
        
        const contentEl = document.createElement('div');
        contentEl.classList.add('message-content');

        if (msg.replyTo) {
            const replyTo = msg.replyTo;
            const replyIndicatorEl = document.createElement("div");
            replyIndicatorEl.classList.add('reply-indicator');
            replyIndicatorEl.textContent = new Parser(replyTo.body || replyTo.text || "")
                .parse('_', '<i>$1</i>')
                .parse('*', '<b>$1</b>')
                .parse('~', '<s>$1</s>')
                .parse('```', '<span style="font-family: monospace;">$1</span>')
                .parse('`', '<code>$1</code>')
                .replace("\n", "<br>")
                .input;

            replyIndicatorEl.addEventListener('click', () => {
                const _msg = document.querySelector(`[id*="${replyTo.id}"]`) as HTMLElement;
                if (_msg) {
                    _msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    this.tempClass(_msg, "mentioned-highlight", 1000);
                }
            });

            bubble.appendChild(replyIndicatorEl);
        }

        const textEl = document.createElement('div');
        const parsed = new Parser(msg.body || msg.text || "")
            .parse('_', '<i>$1</i>')
            .parse('*', '<b>$1</b>')
            .parse('~', '<s>$1</s>')
            .parse('```', '<span style="font-family: monospace;">$1</span>')
            .parse('`', '<code>$1</code>')
            .replace("\n", "<br>")
            .input;

        textEl.innerHTML = parsed;
        contentEl.appendChild(textEl);
        bubble.appendChild(contentEl);
        
        if (msg.hasMedia) {
            let a: HTMLAnchorElement;
            
            if (isLocal) {
                a = this.generateTempMessageLink(msg);
            } else {
                a = document.createElement('a');
                a.innerText = `[Request media]`;
                a.target = "_blank";
                
                const clickListener = async (e: MouseEvent) => {
                    a.removeEventListener('click', clickListener);
                    a.innerText = `[Downloading]`;
                    const mediaMsg = msg.media ? msg : await getMessage(chatId, normalizeId(msg._serialized ? (msg._serialized as any) : msg.id) || "", true);
                    if (!mediaMsg || !mediaMsg?.media?.url) {
                        a.addEventListener('click', clickListener);
                        a.innerText = `[Error, click to try again]`
                        return;
                    }
                    const url = new URL(mediaMsg.media.url);
                    const reqID = url.pathname.split('/').filter(Boolean).pop();
                    
                    if (!reqID) return;
                    const media = await getMedia(reqID);
                    if (!media) return;
                    
                    const objectUrl = URL.createObjectURL(media.blob);
                    (e.target as HTMLAnchorElement).href = objectUrl;
                    
                    if (media.blob.type.startsWith('image/')) {
                        groupDiv.classList.add('image');
                        a.textContent = "";
                        const img = document.createElement('img');
                        img.classList.add('message-image-attachement');
                        img.src = objectUrl;
                        this.ensureScroll(elements.messagesContainer, () => {
                            bubble.before(img);
                        })
                        // const content = bubble.querySelector('.message-content');
                        // if (content) content.remove(); // TODO make images attachment with text look cooler
                    } else {
                        (e.target as HTMLAnchorElement).textContent = media.filename || `Download ${mediaMsg.media.filename}`;
                    }
                }
                
                a.addEventListener('click', clickListener);
            }

            this.ensureScroll(elements.messagesContainer, () => {
                contentEl.appendChild(a);
            });
            
            if (!isLocal && msg._data?.mimetype?.startsWith('image/')) {
                a.click();
            }
        }
        
        const meta = document.createElement('div');
        meta.className = 'message-meta';
        meta.innerHTML = `<span>${timeStr}</span>${statusCheck}`;
        
        bubble.appendChild(meta);
        
        if (isOutgoing) {
            if (prevMsgEl && prevMsgEl.classList.contains('outgoing')) {
                groupDiv.classList.add('same-sender');
            } else {
                const indicator = document.createElement('div');
                indicator.className = 'message-indicator';
                groupDiv.appendChild(indicator);
            }
        } else if (msg.participant) {
            if (!prevMsgEl || prevUid !== prevMsgEl.dataset.from) {
                const indicator = document.createElement('div');
                indicator.className = 'message-indicator';
                groupDiv.appendChild(indicator);
            } else groupDiv.classList.add('same-sender');
        } else {
            if (!prevMsgEl || prevUid !== prevMsgEl.dataset.from) {
                const indicator = document.createElement('div');
                indicator.className = 'message-indicator';
                groupDiv.appendChild(indicator);
            } else groupDiv.classList.add('same-sender');
        }

        bubble.addEventListener('dblclick', () => {
            prepareMention(msg.id.toString(), parsed);
            elements.messageInput?.focus();
        });
        
        groupDiv.appendChild(bubble);
        return groupDiv;
    },
    
    updateMessage(originalMsgId: string, generatedMsg: HTMLElement) {
        const originalMsg = document.querySelector(`#${originalMsgId}`);
        if (originalMsg) {
            originalMsg.replaceWith(generatedMsg)
        }
    },
    
    updateMessageTick(id: string, status: string) {
        let statusCheck;
        if (status === 'read') {
            statusCheck = '<span class="mif-done_all" style="color: var(--online-color); width:14px; height:14px;"></span>';
        } else if (status === 'delivered') {
            statusCheck = '<span class="mif-done" style="width:14px; height:14px;"></span>';
        } else if (status === 'sending') {
            statusCheck = '<span class="mif-earth" style="width:14px; height:14px;"></span>';
        } else {
            statusCheck = '<span class="mif-done" style="width:14px; height:14px;"></span>';
        }
        
        const msgNode = document.getElementById(id);
        if (msgNode) {
            const meta = msgNode.querySelector('.message-meta');
            if (meta) meta.outerHTML = statusCheck;
        }
    },
    
    toggleChatBottomBar() {
        elements.chatBottomBar.classList.toggle("collapsed");
    },
    
    removeChatMessage(msgId: string) {
        const message = document.getElementById(msgId);
        if (message) message.remove();
    },

    autoResizeTextArea(element: HTMLTextAreaElement) {
        const resize = () => {
            element.style.height = 'auto';
            const offset = element.offsetHeight - element.clientHeight;
            const newHeight = element.scrollHeight + offset;

            if (element.scrollHeight > 0) {
                element.style.height = `${newHeight}px`;
            }
        };

        element.addEventListener('input', resize);
        
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                resize();
            }
        });
        observer.observe(element);
    },

    async load(fn: Function) {
        this.loadingMessage("Please wait...");
        elements.loadingScreen.classList.remove('collapsed');
        await fn();
        elements.loadingScreen.classList.add('collapsed');
        this.loadingMessage("Done!");
    },

    loadingMessage(message: string) {
        elements.loadingScreenStatus.innerText = message;
    },

    tempClass(element: HTMLElement, clazz: string, time: number) {
        element.classList.add(clazz);
        setTimeout(() => {
            element.classList.remove(clazz);
        }, time)
    }
};

export class ScrollableView {
    private observer: IntersectionObserver | null = null;
    private activePage: HTMLElement | null = null;
    container: HTMLElement;
    isScrollingProgrammatically = false;
    scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    
    constructor(container: HTMLElement) {
        this.container = container;
        this.setupIntersectionObserver();
        
        window.addEventListener('scroll', (e) => {
            if (this.isScrollingProgrammatically) e.preventDefault();
        });
        
        container.querySelectorAll('.next-page-btn').forEach(nextBtn => {
            nextBtn.addEventListener('click', () => {
                this.next();
            })
        })
    }
    
    private setupIntersectionObserver() {                                                                                                                                                  
        this.observer = new IntersectionObserver((entries) => {                                                                                                                            
            entries.forEach(entry => {                                                                                                                                                     
                if (entry.isIntersecting && entry.target !== this.activePage) {                                                                                                            
                    this.activePage = entry.target as HTMLElement;                                                                                                                         
                    
                    entry.target.dispatchEvent(new CustomEvent('intoView', {                                                                                                               
                        bubbles: true,                                                                                                                                                     
                        detail: {                                                                                                                                                          
                            page: entry.target,                                                                                                                                            
                            index: this.getCurrentIndex()                                                                                                                                  
                        }                                                                                                                                                                  
                    }));                                                                                                                                                                   
                }                                                                                                                                                                          
            });                                                                                                                                                                            
        }, {                                                                                                                                                                               
            root: this.container,                                                                                                                                                          
            threshold: 0.6                                                                                               
        });                                                                                                                                                                                
        
        this.observePages();                                                                                                                                                               
    }
    
    observePages() {                                                                                                                                                                       
        if (!this.observer) return;                                                                                                                                                        
        Array.from(this.container.children).forEach(child => {                                                                                                                             
            this.observer?.observe(child);                                                                                                                                                 
        });                                                                                                                                                                                
    }
    
    get pages(): HTMLElement[] {
        return Array.from(this.container.children) as HTMLElement[];
    }
    
    getCurrentIndex(): number {
        const width = this.container.clientWidth;
        if (width === 0) return 0;
        return Math.round(this.container.scrollLeft / width);
    }
    
    getCurrentScreen(): HTMLElement | null {
        const pages = this.pages;
        return pages[this.getCurrentIndex()] || null;
    }
    
    scrollToIndex(index: number, smooth = true) {
        const pages = this.pages;
        if (index >= 0 && index < pages.length) {
            this.scrollTo(pages[index], smooth);
        }
    }
    
    next(smooth = true) {
        this.scrollToIndex(this.getCurrentIndex() + 1, smooth);
    }
    
    previows(smooth = true) {
        this.scrollToIndex(this.getCurrentIndex() - 1, smooth);
    }
    
    scrollTo(element: HTMLElement, smooth = true) {
        this.isScrollingProgrammatically = true;
        element.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto',
            inline: 'start',
            block: 'nearest'
        });
        setTimeout(() => { this.isScrollingProgrammatically = false; }, smooth ? 400 : 50);
    }
    
    getCurrentExtraPage(): number {       
        const pages = Array.from(elements.extraPages);
        const activeIndex = pages.findIndex(page => page.classList.contains("shown"));                     
        return activeIndex !== -1 ? activeIndex : 0;
    }
}

elements.scrollableViews.forEach(view => {
    views.set(view, new ScrollableView(view));
})