import { formatTime, normalizeId } from "./utils";
import { getChatPicture, getMessage, getMedia, getMoreChatMessages } from "./storage";
import { getCurrentChat } from "./app";
import type { Chat, Message } from "./types";

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
    messageInput: document.getElementById('message-input') as HTMLInputElement,
    backToSidebarBtn: document.querySelector('.chat-header') as HTMLElement,
    sidebar: document.querySelector('.sidebar') as HTMLElement,
    appContainer: document.querySelector('.app-container') as HTMLElement,
    settingsModal: document.getElementById('settings-page') as HTMLElement,
    settingsIconBtn: document.getElementById('settings-sidebar-btn') as HTMLButtonElement,
    saveSettingsBtn: document.getElementById('save-settings') as HTMLButtonElement,
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
    markreadBtn: document.getElementById('markread-btn') as HTMLButtonElement,
    extraPages: document.querySelectorAll('.extra-page') as NodeListOf<HTMLElement>,
    desktopSidebarButtons: document.querySelectorAll("#desktop-aside button") as NodeListOf<HTMLButtonElement>,
    contentUserName: document.querySelectorAll('[data-content="app-user"]') as NodeListOf<HTMLElement>,
    contentUserNumber: document.querySelectorAll('[data-content="app-user-number"]') as NodeListOf<HTMLElement>,
    resourceUserPic: document.querySelectorAll('[data-resource="app-user-image"]') as NodeListOf<HTMLImageElement>,
    valueUserStatus: document.querySelectorAll('[data-value="app-user-status"]') as NodeListOf<HTMLInputElement>,
    inputUserStatus: document.getElementById('profile-page-status-input') as HTMLInputElement,
    selectable: document.querySelectorAll('.selectable') as NodeListOf<HTMLElement>,
};

export const ui = {
    showExtraPage(pageId: string) {
        elements.extraPages.forEach(page => {
            if (page.id != pageId) {
                page.style.display = "none";
            } else {
                page.style.display = "flex";
            }
        })
    },

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
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
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
          <span class="chat-item-msg" data-chatid="${chat.id}">
            ${chat.lastMessage || 'No messages yet'}
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

            const activeChatState = getCurrentChat();

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
            loadMoreButton.after(this.generateMessage(msg, userId, chatId));
        });
    },

    /**
    * Append a single message (used for optimistic updates immediately upon sending)
    */
    appendSingleMessage(msg: Message, userID: string, chatId: string, isLocal: boolean = false) {
        elements.messagesContainer.appendChild(this.generateMessage(msg, userID, chatId, isLocal))
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
        const isOutgoing = msg.fromMe || msg.sender === 'me';

        function getPrevMessageElem() {
            return elements.messagesContainer.lastElementChild as HTMLElement | null;
        }

        const prevMsgEl = getPrevMessageElem();

        const groupDiv = document.createElement('div');
        groupDiv.className = `message-group selectable ${isOutgoing ? 'outgoing' : 'incoming'}`;
        groupDiv.id = normalizeId(msg._serialized ? (msg._serialized as any) : msg.id) || "msg-id";
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
        const textEl = document.createElement('div');
        textEl.innerHTML = msg.body || msg.text || "";
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
                        a.textContent = "";
                        const img = document.createElement('img');
                        img.classList.add('message-image-attachement');
                        img.src = objectUrl;
                        bubble.after(img);
                        const content = bubble.querySelector('.message-content');
                        if (content) content.remove();
                    } else {
                        (e.target as HTMLAnchorElement).textContent = media.filename || `Download ${mediaMsg.media.filename}`;
                    }
                }

                a.addEventListener('click', clickListener);
            }

            contentEl.appendChild(a);

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
    }
};
