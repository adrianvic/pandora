import { formatTime } from "./utils.js";

// DOM Selector Cache
export const elements = {
    chatList: document.getElementById('chat-list'),
    chatsLoader: document.getElementById('chats-loader'),
    chatCountBadge: document.getElementById('chat-count'),
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
    backToSidebarBtn: document.getElementById('back-to-sidebar'),
    sidebar: document.querySelector('.sidebar'),
    settingsModal: document.getElementById('settings-modal'),
    settingsIconBtn: document.querySelector('.header-actions button[title="Settings"]'),
    closeSettingsBtn: document.getElementById('close-settings'),
    cancelSettingsBtn: document.getElementById('cancel-settings'),
    saveSettingsBtn: document.getElementById('save-settings'),
    inputWahaUrl: document.getElementById('settings-waha-url'),
    inputSession: document.getElementById('settings-session'),
    inputApiKey: document.getElementById('settings-api-key'),
    loggedUserName: document.getElementById('pandora-username'),
    userIcon: document.getElementById('pandora-user-icon')
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

    /**
     * Render sidebar contact chats list
     */
    renderChatList(chats, activeChat, onChatSelect) {
        elements.chatList.innerHTML = '';
        elements.chatCountBadge.textContent = chats.length;

        if (chats.length === 0) {
            elements.chatList.innerHTML = `<li class="loading-chats">No chats found</li>`;
            return;
        }

        chats.forEach(chat => {
            const li = document.createElement('li');
            li.className = `chat-item ${activeChat && activeChat.id === chat.id ? 'active' : ''}`;
            li.dataset.id = chat.id;

            const initials = chat.name ? chat.name.substring(0, 1).toUpperCase() : '?';
            const hasUnread = chat.unreadCount && chat.unreadCount > 0;
            const timeStr = formatTime(chat.timestamp || new Date());

            li.innerHTML = `
                <div class="avatar">${initials}</div>
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
        });
    },

    /**
     * Render chat message log inside chat view container
     */
    renderMessages(messages, activeChatName) {
        elements.messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            elements.messagesContainer.innerHTML = '<div class="loading-chats">No messages. Say hello!</div>';
            return;
        }

        messages.forEach(msg => {
            const isOutgoing = msg.fromMe || msg.sender === 'me';
            const groupDiv = document.createElement('div');
            groupDiv.className = `message-group ${isOutgoing ? 'outgoing' : 'incoming'}`;
            groupDiv.id = msg.id;
            
            const senderName = isOutgoing ? 'Me' : (msg.senderName || activeChatName);
            const timeStr = formatTime(msg.timestamp || new Date());
            
            let statusCheck = '';
            if (isOutgoing) {
                if (msg.status === 'read') {
                    statusCheck = '<i data-lucide="check-check" style="color: var(--online-color); width:14px; height:14px;"></i>';
                } else if (msg.status === 'delivered') {
                    statusCheck = '<i data-lucide="check-check" style="width:14px; height:14px;"></i>';
                } else {
                    statusCheck = '<i data-lucide="check" style="width:14px; height:14px;"></i>';
                }
            }

            groupDiv.innerHTML = `
                ${!isOutgoing ? `<span class="message-sender">${senderName}</span>` : ''}
                <div class="message-bubble">
                    ${msg.body || msg.text}
                    <div class="message-meta">
                        <span>${timeStr}</span>
                        ${statusCheck}
                    </div>
                </div>
            `;

            elements.messagesContainer.appendChild(groupDiv);
        });

        lucide.createIcons();
        this.scrollToBottom();
    },

    /**
     * Append a single message (used for optimistic updates immediately upon sending)
     */
    appendSingleMessage(msg, activeChatName) {
        if (elements.messagesContainer.querySelector('.loading-chats')) {
            elements.messagesContainer.innerHTML = '';
        }

        const isOutgoing = msg.fromMe || msg.sender === 'me';
        const groupDiv = document.createElement('div');
        groupDiv.className = `message-group ${isOutgoing ? 'outgoing' : 'incoming'}`;
        groupDiv.id = msg.id;
        
        const senderName = isOutgoing ? 'Me' : activeChatName;
        const timeStr = formatTime(msg.timestamp || new Date());
        
        groupDiv.innerHTML = `
            ${!isOutgoing ? `<span class="message-sender">${senderName}</span>` : ''}
            <div class="message-bubble">
                ${msg.body || msg.text}
                <div class="message-meta">
                    <span>${timeStr}</span>
                    <i data-lucide="clock" style="width:12px; height:12px; opacity:0.6;"></i>
                </div>
            </div>
        `;

        elements.messagesContainer.appendChild(groupDiv);
        lucide.createIcons();
    }
};
