import { formatTime } from "./utils.js";
import { waha } from "./waha.js";
import { config } from "./config.js";

// DOM Selector Cache
export const elements = {
    chatList: document.getElementById('chat-list'),
    chatsLoader: document.getElementById('chats-loader'),
    chatSearch: document.getElementById('chat-search'),
    refreshChatsBtn: document.getElementById('refresh-chats-btn'),
    backendStatusText: document.getElementById('backend-status-text'),
    apiStatusIndicator: document.querySelector('.pulse-dot'),
    noChatState: document.getElementById('no-chat-state'),
    activeChatContainer: document.getElementById('active-chat-container'),
    activeChatName: document.getElementById('active-chat-name'),
    activeChatAvatar: document.getElementById('active-chat-avatar'),
    messagesContainer: document.getElementById('messages-container'),
    messageForm: document.getElementById('message-form'),
    messageInput: document.getElementById('message-input'),
    // backToSidebarBtn: document.getElementById('back-to-sidebar'),
    backToSidebarBtn: document.querySelector('.chat-header'),
    sidebar: document.querySelector('.sidebar'),
    settingsModal: document.getElementById('settings-modal'),
    settingsIconBtn: document.querySelector('.header-actions button[title="Settings"]'),
    cancelSettingsBtn: document.getElementById('cancel-settings'),
    saveSettingsBtn: document.getElementById('save-settings'),
    inputWahaUrl: document.getElementById('settings-waha-url'),
    inputSession: document.getElementById('settings-session'),
    inputApiKey: document.getElementById('settings-api-key'),
    loggedUserName: document.getElementById('pandora-username'),
    chatBottomBar: document.getElementById('chat-bottom-bar'),
    chatBottomBarBtn: document.getElementById('chat-bottom-bar-btn'),
    chatInputPanel: document.getElementById('chat-input-panel'),
    attachmentInput: document.getElementById('attachment-input'),
    attachmentBtn: document.getElementById('attachment-btn'),
};

export const ui = {
    /**
    * Show or hide Settings connection modal
    */
    toggleModal(show) {
        if (show) {
            elements.settingsModal.classList.remove('hidden');
        } else {
            elements.settingsModal.classList.add('hidden');
        }
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
            li.className = `chat-item ${activeChat && activeChat.id === chat.id ? 'active' : ''}`;
            li.dataset.id = chat.id;
            
            const picture = await waha.getChatPicture(chat.id);
            const initials = chat.name ? chat.name.substring(0, 1).toUpperCase() : '?';
            const hasUnread = chat.unreadCount && chat.unreadCount > 0;
            const timeStr = formatTime(chat.timestamp || new Date());
            
            li.innerHTML = `
            <div class="avatar"><img src="${picture.url ? picture.url : ""}" alt="${initials}"></div>
            <div class="chat-item-info">
                <div class="chat-item-meta">
                    <span class="chat-item-name">${chat.name}</span>
                    <span class="chat-item-time">${timeStr}</span>
                </div>
                <div class="chat-item-preview">
                    <span class="chat-item-msg">${chat.lastMessage || 'No messages yet'}</span>
                    ${hasUnread ? `<span class="unread-badge">${chat.unreadCount}</span>` : ''}
                </div>
            </div>
        `;
            
            li.addEventListener('click', () => onChatSelect(chat));
            elements.chatList.appendChild(li);
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
        
        for (const msg of messages) {
            this.appendSingleMessage(msg, activeChatName, userID, chatId);
        }
        
        lucide.createIcons();
        this.scrollToBottom();
    },
    
    /**
    * Append a single message (used for optimistic updates immediately upon sending)
    */
    appendSingleMessage(msg, activeChatName, userID, chatId) {
        elements.messagesContainer.appendChild(this.generateMessage(msg, activeChatName, userID, chatId))
    },
    
    generateMessage(msg, activeChatName, userID, chatId) {
        const isOutgoing = msg.fromMe || msg.sender === 'me';
        
        const groupDiv = document.createElement('div');
        groupDiv.className = `message-group ${isOutgoing ? 'outgoing' : 'incoming'}`;
        groupDiv.id = msg.id;
        groupDiv.dataset.from = msg.participant || msg.from;
        
        const senderName = isOutgoing ? userID : (msg._data.notifyName || activeChatName);
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
        
        if (!isOutgoing) {
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
            const a = document.createElement('a');
            a.innerText = `[Request media]`;
            a.target = "_blank";
            
            const clickListener = async (e) => {
                a.removeEventListener('click', clickListener);
                a.innerText = `[Downloading]`;
                const mediaMsg = await waha.getSingleChatMessage(chatId, msg.id, true);
                
                const url = new URL(mediaMsg.media.url);
                const reqID = url.pathname.split('/').filter(Boolean).pop();
                
                const { blob, filename } = await waha.downloadMedia(reqID);
                
                const objectUrl = URL.createObjectURL(blob);
                e.target.href = objectUrl;
                
                if (blob.type.startsWith('image/')) {
                    a.textContent = "";
                    const img = document.createElement('img');
                    img.classList.add('message-image-attachement');
                    img.src = objectUrl;
                    a.appendChild(img);
                } else {
                    e.target.textContent = filename || `Download ${mediaMsg.media.filename}`;
                }
            }
            
            contentEl.appendChild(a);
            a.addEventListener('click', clickListener);
            
            if (msg._data.mimetype.startsWith('image/')) {
                a.click();
            }
        }

        
        const meta = document.createElement('div');
        meta.className = 'message-meta';
        meta.innerHTML = `<span>${timeStr}</span>${statusCheck}`;
        
        bubble.appendChild(meta);
        let uid = "";
        
        function getPrevMessageElem() {
            return elements.messagesContainer.lastElementChild; // <‑‑ key change
        }
        
        const prevMsgEl = getPrevMessageElem();
        
        if (isOutgoing) {
            if (prevMsgEl && prevMsgEl.classList.contains('outgoing')) {
            } else {
                groupDiv.appendChild(document.createElement('div')).className = 'message-indicator';
            }
        } else if (msg.participant) {
            uid = msg.participant;
            if (!prevMsgEl || uid !== prevMsgEl.dataset.from) {
                groupDiv.appendChild(document.createElement('div')).className = 'message-indicator';
            }
        } else {
            uid = msg.from;
            if (!prevMsgEl || uid !== prevMsgEl.dataset.from) {
                groupDiv.appendChild(document.createElement('div')).className = 'message-indicator';
            }
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
    
    toggleChatBottomBar() {
        elements.chatBottomBar.classList.toggle("collapsed");
    }
};
