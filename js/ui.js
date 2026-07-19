import { formatTime, normalizeId } from "./utils.js";
import { getChatPicture, getMessage, getMedia, getMoreChatMessages } from "./storage.js";
import { getCurrentChat } from "./app.js";

export const elements = {
    chatList: document.getElementById('chat-list'),
    chatsLoader: document.getElementById('chats-loader'),
    chatSearch: document.getElementById('chat-search'),
    backendStatusText: document.getElementById('backend-status-text'),
    apiStatusIndicator: document.querySelector('.pulse-dot'),
    noChatState: document.getElementById('no-chat-state'),
    activeChatContainer: document.getElementById('active-chat-container'),
    activeChatName: document.getElementById('active-chat-name'),
    activeChatAvatar: document.getElementById('active-chat-avatar'),
    messagesContainer: document.getElementById('messages-container'),
    messageForm: document.getElementById('message-form'),
    messageInput: document.getElementById('message-input'),
    backToSidebarBtn: document.querySelector('.chat-header'),
    sidebar: document.querySelector('.sidebar'),
    appContainer: document.querySelector('.app-container'),
    settingsModal: document.getElementById('settings-page'),
    settingsIconBtn: document.getElementById('settings-sidebar-btn'),
    saveSettingsBtn: document.getElementById('save-settings'),
    inputWahaUrl: document.getElementById('settings-waha-url'),
    inputSession: document.getElementById('settings-session'),
    inputApiKey: document.getElementById('settings-api-key'),
    inputBackgroundImage: document.getElementById('settings-background-image'),
    inputBackgroundOpacity: document.getElementById('settings-background-opacity'),
    loggedUserName: document.getElementById('pandora-username'),
    chatBottomBar: document.getElementById('chat-bottom-bar'),
    chatBottomBarBtn: document.getElementById('chat-bottom-bar-btn'),
    chatInputPanel: document.getElementById('chat-input-panel'),
    attachmentInput: document.getElementById('attachment-input'),
    attachmentBtn: document.getElementById('attachment-btn'),
    markreadBtn: document.getElementById('markread-btn'),
    extraPages: document.querySelectorAll('.extra-page'),
    desktopSidebarButtons: document.querySelectorAll("#desktop-aside button"),
    contentUserName: document.querySelectorAll('[data-content="app-user"]'),
    contentUserNumber: document.querySelectorAll('[data-content="app-user-number"]'),
    resourceUserPic: document.querySelectorAll('[data-resource="app-user-image"]'),
    valueUserStatus: document.querySelectorAll('[data-value="app-user-status"]'),
    inputUserStatus: document.getElementById('profile-page-status-input'),
    selectable: document.querySelectorAll('.selectable'),
};

export const ui = {
    showExtraPage(pageId) {
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
    toggleChatState(hasActive) {
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
    updateConnectionStatus(isConnected, text) {
        elements.backendStatusText.textContent = text;
        if (isConnected) {
            elements.apiStatusIndicator.style.backgroundColor = 'var(--online-color)';
            elements.apiStatusIndicator.style.animation = 'pulse 1.8s infinite';
        } else {
            elements.apiStatusIndicator.style.backgroundColor = '#ef4444';
            elements.apiStatusIndicator.style.animation = 'none';
        }
    },
    
    async renderChatList(chats, activeChat, onChatSelect) {
        elements.chatList.innerHTML = '';
        chats.sort((a, b) => b.timestamp - a.timestamp);
        
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
                    const img = li.querySelector(`img[data-chat-avatar="${chat.id}"]`);
                    if (img) img.src = picture.url ? picture.url : '';
                } catch (e) {
                }
            })();
        }
    },
    
    async updateChatInChatList(msg) {
        const chat = document.querySelector(`.chat-item[data-id="${msg.fromMe ? msg.to : msg.from}"]`);
        
        if (chat) {
            const messageItem = chat.querySelector('.chat-item-msg');
            const time = chat.querySelector('.chat-item-time')
            messageItem.innerText = msg.body || msg.text || 'Media message';
            time.innerText = msg.timestamp ? formatTime(msg.timestamp) : Date.now();
            
            const activeChatState = getCurrentChat();
            
            if (!msg.fromMe && (!activeChatState || activeChatState.id !== (msg.fromMe ? msg.to : msg.from))) {
                const unreadBadge = chat.querySelector('.unread-badge');
                if (unreadBadge) unreadBadge.innerText = (Number(unreadBadge.innerHTML) || 0) + 1;
            }
        }
    },
    
    /**
    * Render chat message log inside chat view container
    */
    async renderMessages(messages, activeChatName, userID, chatId) {
        elements.messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            elements.messagesContainer.innerHTML = '<div class="loading-chats">No messages. Say hello!</div>';
            return;
        }
        
        const loadMore = document.createElement("button");
        loadMore.classList.add("load-more-btn");
        loadMore.innerText = "Load more";
        loadMore.addEventListener('click', () => {
            this.loadMoreMessages(chatId, userID);
        });
        elements.messagesContainer.appendChild(loadMore);
        
        for (const msg of messages) {
            this.appendSingleMessage(msg, userID, chatId);
        }
        
        this.scrollToBottom();
    },
    
    async loadMoreMessages(chatId, userId) {
        const oldest = document.querySelector('.message-group:first-of-type');
        const oldestTimestamp = oldest.dataset.timestamp;
        const oldestId = oldest.id;
        console.log(oldest)
        console.log(oldestId)
        console.log(oldestTimestamp)
        
        const loadMoreButton = document.querySelector('.load-more-btn');
        loadMoreButton.removeEventListener('click', this.loadMoreMessages);
        
        const msgs = await getMoreChatMessages(chatId, oldestTimestamp, oldestId);
        msgs.shift();
        
        msgs.forEach(async msg => {
            loadMoreButton.after(this.generateMessage(msg, userId, chatId));
        });
        
        loadMoreButton.addEventListener('click', this.loadMoreMessages);
    },
    
    /**
    * Append a single message (used for optimistic updates immediately upon sending)
    */
    appendSingleMessage(msg, userID, chatId, isLocal = false) {
        elements.messagesContainer.appendChild(this.generateMessage(msg, userID, chatId, isLocal))
    },
    
    generateTempMessageLink(msg) {
        const a = document.createElement('a');
        a.target = "_blank";
        a.href = msg.media.url;
        
        if (msg._data?.mimetype?.startsWith('image/')) {
            const img = document.createElement('img');
            img.classList.add('message-image-attachement');
            img.src = msg.media.url;
            a.appendChild(img);
        } else {
            a.textContent = msg.media.filename || "Download file";
            a.download = msg.media.filename;
        }
        
        return a;
    },
    
    generateMessage(msg, userID, chatId, isLocal = false) {
        const isOutgoing = msg.fromMe || msg.sender === 'me';
        
        function getPrevMessageElem() {
            return elements.messagesContainer.lastElementChild;
        }
        
        const prevMsgEl = getPrevMessageElem();
        
        const groupDiv = document.createElement('div');
        groupDiv.className = `message-group selectable ${isOutgoing ? 'outgoing' : 'incoming'}`;
        groupDiv.id = normalizeId(msg._serialized ? msg : msg.id);
        groupDiv.dataset.timestamp = msg.timestamp;
        groupDiv.dataset.from = msg.participant || msg.from;
        
        const senderName = isOutgoing ? userID : (msg._data.notifyName || msg.from);
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
        
        let prevUid;
        
        if (msg.participant) {
            prevUid = msg.participant;
        } else {
            prevUid = msg.from;
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
            let a;
            
            if (isLocal) {
                a = this.generateTempMessageLink(msg);    
            } else {
                a = document.createElement('a');
                a.innerText = `[Request media]`;
                a.target = "_blank";
                
                const clickListener = async (e) => {
                    a.removeEventListener('click', clickListener);
                    a.innerText = `[Downloading]`;
                    const mediaMsg = msg.media ? msg : await getMessage(chatId, normalizeId(msg._serialized ? msg : msg.id), true);
                    if (!mediaMsg || !mediaMsg?.media.url) {
                        a.addEventListener('click', clickListener);
                        a.innerText = `[Error, click to try again]`
                        return;
                    }
                    const url = new URL(mediaMsg.media.url);
                    const reqID = url.pathname.split('/').filter(Boolean).pop();
                    
                    const { blob, filename } = await getMedia(reqID);
                    
                    const objectUrl = URL.createObjectURL(blob);
                    e.target.href = objectUrl;
                    
                    if (blob.type.startsWith('image/')) {
                        a.textContent = "";
                        const img = document.createElement('img');
                        img.classList.add('message-image-attachement');
                        img.src = objectUrl;
                        bubble.after(img);
                        bubble.querySelector('.message-content').remove();
                    } else {
                        e.target.textContent = filename || `Download ${mediaMsg.media.filename}`;
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
                groupDiv.appendChild(document.createElement('div')).className = 'message-indicator';
            }
        } else if (msg.participant) {
            if (!prevMsgEl || prevUid !== prevMsgEl.dataset.from) {
                groupDiv.appendChild(document.createElement('div')).className = 'message-indicator';
            } else groupDiv.classList.add('same-sender');
        } else {
            if (!prevMsgEl || prevUid !== prevMsgEl.dataset.from) {
                groupDiv.appendChild(document.createElement('div')).className = 'message-indicator';
            } else groupDiv.classList.add('same-sender');
        }
        
        groupDiv.appendChild(bubble);
        return groupDiv;
    },
    
    updateMessage(originalMsgId, generatedMsg) {
        const originalMsg = document.querySelector(`#${originalMsgId}`);
        if (originalMsg) {
            originalMsg.replaceWith(generatedMsg)
        }
    },
    
    updateMessageTick(id, status) {
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
        
        document.getElementById(id).querySelector('.message-meta').outerHTML = statusCheck;
    },
    
    toggleChatBottomBar() {
        elements.chatBottomBar.classList.toggle("collapsed");
    },
    
    removeChatMessage(msgId) {
        const message = document.getElementById(msgId);
        if (message) message.remove();
    }
};
