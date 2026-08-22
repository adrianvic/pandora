import type { Message } from "./types";

export const elements = {
    chatSearch: document.getElementById('chat-search') as HTMLInputElement,
    backendStatusText: document.getElementById('backend-status-text') as HTMLSpanElement,
    apiStatusIndicator: document.querySelector('.pulse-dot') as HTMLSpanElement,
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
    settingTheme: document.querySelector('#settings-theme') as HTMLFieldSetElement,
    previewImage: document.querySelector('#image-preview-img') as HTMLImageElement,
    previewSubtitle: document.querySelector('#image-preview-subtitle') as HTMLParagraphElement,
    imagePreview: document.querySelector('#image-preview') as HTMLDivElement,
};

export const ui = {
    /**
    * Scroll message list automatically to bottom
    */
    scrollToBottom(el: HTMLElement) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight;
            });
        });
    },
    
    ensureScroll(container: HTMLElement, after: Function) {
        const threshold = 10;
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;

        after();

        if (isAtBottom) {
            requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;
            });
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

    // async loadMoreMessages(chatId: string, userId: string) {
    //     const oldest = document.querySelector('.message-group:first-of-type') as HTMLElement;
    //     if (!oldest) return;
    //     const oldestTimestamp = oldest.dataset.timestamp;
    //     const oldestId = oldest.id;
        
    //     const loadMoreButton = document.querySelector('.load-more-btn') as HTMLButtonElement;
        
    //     const msgs = await getMoreChatMessages(chatId, oldestTimestamp, oldestId);
    //     // JS version had msgs.shift(), probably to avoid duplication of the oldest message
    //     msgs.shift();
        
    //     msgs.forEach(async msg => {
    //         const message = this.generateMessage(msg, userId, chatId);
    //         if (message) {
    //             loadMoreButton.after();
    //         }
    //     });
    // },
    
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
    
    updateMessage(originalMsgId: string, generatedMsg: HTMLElement) {
        const originalMsg = document.querySelector(`#${originalMsgId}`);
        if (originalMsg) {
            originalMsg.replaceWith(generatedMsg)
        }
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