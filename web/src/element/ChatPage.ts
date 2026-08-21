import { getChatMessages, getGroupUsers, getUsersFromGroup } from "../storage";
import { Chat, Contact } from "../types";
import { elements, ui } from "../ui";
import { compensateMessageOrdering } from "../utils";
import { waha } from "../waha";
import { BaseComponent } from "./BaseComponent";
import { MessagesContainer } from "./MessagesContainer";

export class ChatPage<T extends HTMLElement = HTMLElement> extends BaseComponent {
    public readonly bottomBar: HTMLElement;
    public readonly bottomExtraBar: HTMLElement;
    public readonly replyIndicator: HTMLElement;
    public readonly mentionSuggestion: HTMLElement;
    public readonly header: HTMLElement;
    private readonly messagesContainerReceptacle: HTMLElement;
    public messagesContainer: MessagesContainer | null = null;
    public readonly noChatState: HTMLElement;
    public readonly activeChatState: HTMLElement;
    public readonly messageForm: HTMLFormElement;
    public readonly messageTextArea: HTMLTextAreaElement;
    readonly sendButton: HTMLButtonElement;
    readonly chatTitle: HTMLElement;
    readonly attachmentInput: HTMLInputElement;
    readonly attachmentButton: HTMLButtonElement;
    readonly bottomBarButton: HTMLButtonElement;
    replyID: string | null = null;
    replyText: string | null = null;
    mentioned: Contact[] = [];
    
    constructor(elementOrTag: T | string) {
        super(elementOrTag);
        this.element.classList.add('chat-area');
        
        this.header = document.createElement('header');
        this.header.classList.add('chat-header');
        this.header.innerHTML =
        `
            <div class="active-contact-info">
                <div class="avatar active-avatar" id="active-chat-avatar">C</div>
                <div>
                    <h3 id="active-chat-name">Contact Name</h3>
                    <span class="contact-status" id="active-chat-status"></span>
                </div>
            </div>
            <div class="chat-actions">
            </div>
            `;
        
        this.chatTitle = this.header.querySelector('.contact-status') as HTMLElement;
        
        this.noChatState = document.createElement('div');
        this.noChatState.classList.add('no-chat-state');
        this.noChatState.id = "no-chat-state";
        
        this.replyIndicator = document.createElement('div');
        this.replyIndicator.classList.add('collapsed');
        this.replyIndicator.id = "mentioning-indicator";
        this.replyIndicator.addEventListener('click', this.clearReply);
        
        this.mentionSuggestion = document.createElement('div');
        this.mentionSuggestion.id = "mentioning-suggestion";
        this.mentionSuggestion.classList.add('collapsed');
        this.mentionSuggestion.innerHTML =
        `
            <div class='loading-animation-wrapper'>
                <div class="animation">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>f')
                </div>
            </div>
            <div id="mention-suggestions"></div>
            `;
        
        this.bottomBar = document.createElement('footer');
        this.bottomBar.classList.add('input-form');
        this.bottomBar.id = "message-form";
        this.bottomBar.innerHTML =
        `
            <div class="input-actions-left">
                <button id="chat-bottom-bar-btn" class="chat-footer-btn icon-btn mif-expand-less mif-3x" title="Expand"></button>
            </div>
        `;
        
        this.messageForm = document.createElement('form');
        this.messageForm.classList.add('input-form');
        this.messageForm.id = 'message-form';
        
        this.messageForm.innerHTML =
        `
            <textarea type="text" id="message-input" rows="1" placeholder="Type a message..." autocomplete="off"></textarea>
            <button type="submit" class="chat-footer-btn send-btn mif-paper-plane mif-3x" id="send-button"></button>
            `;
        
        this.messageTextArea = document.createElement('textarea');
        this.messageTextArea.id = 'message-input';
        this.messageTextArea.rows = 1;
        this.messageTextArea.placeholder = "Type a message...";
        this.messageTextArea.autocomplete = 'off';
        
        this.sendButton = document.createElement('button');
        this.sendButton.type = 'submit';
        this.sendButton.classList = 'chat-footer-btn send-btn mif-paper-plane mif 3x';
        this.sendButton.id = 'send-button';
        
        this.messageForm.appendChild(this.messageTextArea);
        this.messageForm.appendChild(this.sendButton);
        this.bottomBar.appendChild(this.messageForm);
        
        ui.autoResizeTextArea(this.messageTextArea);
        
        this.messageTextArea.addEventListener('input', (e) => {
            const inputEvent = e as InputEvent;
            
            this.mentioned.forEach(c => {
                if (!this.messageTextArea.value.includes(`@${c.number}`)) {
                    this.removeMention(c);
                }
            })
            
            if (inputEvent.data === "@") {
                this.suggestMention();
            } else {
                this.mentionSuggestion.classList.add('collapsed');
            }
        });
        
        this.messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        this.messageTextArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.bottomBar.style.height = `${this.messageForm.offsetHeight}px`;
        const observer = new ResizeObserver(() => {
            this.bottomBar.style.height = `${this.messageForm.offsetHeight}px`;
        });
        
        
        observer.observe(this.messageForm);

        this.bottomBarButton = this.bottomBar.querySelector('#chat-bottom-bar-btn') as HTMLButtonElement;

        this.bottomBarButton.addEventListener('click', ui.toggleChatBottomBar);
        this.bottomBar.addEventListener('click', (e) => {
            if (e.target == e.currentTarget) this.bottomBar.classList.toggle("collapsed");
        });
        
        this.bottomExtraBar = document.createElement('footer');
        this.bottomExtraBar.classList = "chat-expanded-panel alternate-panel collapsed";
        this.bottomExtraBar.id = "chat-bottom-bar";
        this.bottomExtraBar.innerHTML = 
        `
            <button id="markread-btn" class="icon-btn send-btn mif-done_all mif-2x" title="Mark read"></button>
            <input id="attachment-input" style="display: none;" type="file">
            <button id="attachment-btn" class="icon-btn send-btn mif-attachment mif-2x" title="Attach file"></button>
            <button id="mention-btn" class="icon-btn send-btn mif-face mif-2x" title="Mention user"></button>
            <button id="clear-chat-btn" class="icon-btn send-btn mif-bin mif-2x" title="Delete chat"></button>
            `;
        
        this.attachmentInput = this.bottomExtraBar.querySelector('#attachment-input') as HTMLInputElement;
        this.attachmentButton = this.bottomExtraBar.querySelector('#attachment-btn') as HTMLButtonElement;
        
        this.attachmentInput.addEventListener('change', (e) => {
            const firstFile = (e.target as HTMLInputElement).files?.[0];
            if (firstFile) this.sendFileMessage(firstFile);
        });
        
        this.activeChatState = document.createElement('div');
        this.activeChatState.classList = 'active-chat-container hidden';
        this.activeChatState.id = 'active-chat-container';
        
        this.messagesContainerReceptacle = document.createElement('div');
        
        this.activeChatState.appendChild(this.header);
        this.activeChatState.appendChild(this.messagesContainerReceptacle);
        this.activeChatState.appendChild(this.mentionSuggestion);
        this.activeChatState.appendChild(this.replyIndicator);
        this.activeChatState.appendChild(this.bottomBar);
        this.activeChatState.appendChild(this.bottomExtraBar);
        
        this.element.appendChild(this.noChatState);
        this.element.appendChild(this.activeChatState);
    }
    
    public loadChat(chat: Chat, userID: string): MessagesContainer {
        if (this.messagesContainer) this.closeChat(false);
        
        this.chatTitle.textContent = chat.name.toUpperCase();
        this.messagesContainerReceptacle.innerHTML = '';
        this.messagesContainer = new MessagesContainer(this.messagesContainerReceptacle, chat.id, userID);
        this.element.dispatchEvent(new CustomEvent('load-chat'));
        
        async () => {
            try {
                const rawMessages = await getChatMessages(chat.id);
                const processedMessages = compensateMessageOrdering(rawMessages);
                this.messagesContainer?.loadBulkMessages(processedMessages);
            } catch (error) {
                console.error('Failed to load messages:', error);
                elements.messagesContainer.innerHTML = '<div class="loading-chats">Error loading messages</div>';
            }
        }
        
        return this.messagesContainer;
    }
    
    public closeChat(force = false) {
        this.clearMentions();
        this.clearReply();
        
        this.element.dispatchEvent(new CustomEvent('close-chat', {
            detail: {
                force: force
            }
        }));
        
        this.messagesContainer?.setVisibility(false);
        this.messagesContainer?.destroy();
        this.messagesContainer = null;
    }
    
    setReply(id: string, text: string) {
        this.replyID = id;
        this.replyText = text;
        const span = this.replyIndicator.querySelector('span');
        if (span) span.innerText = `Mentioning "${text}".`;
        this.replyIndicator.classList.remove('collapsed');
    }
    
    clearReply() {
        this.replyID = null;
        this.replyText = null;
        const span = this.replyIndicator.querySelector('span');
        if (span) span.innerText = '';
        this.replyIndicator.classList.add('collapsed');
    }
    
    mention(contact: Contact) {
        this.mentioned.push(contact);
    }
    
    clearMentions() {
        this.mentioned = [];
    }
    
    removeMention(contact: Contact) {
        const index = this.mentioned.indexOf(contact);
        if (index === -1) return;
        this.mentioned.splice(index, 1);
    }
    
    getMentionedIDs(): string[] {
        const m = this.mentioned.map(x => x.id);
        const r: string[] = [];
        m.forEach(_m => { if (_m) r.push(_m) })
            
        return r;
    }
    
    async suggestMention() {
        this.mentionSuggestion.innerHTML = "";
        this.mentionSuggestion.classList.remove("collapsed");
        this.mentionSuggestion.classList.add("loading");
        
        try {
            // if (!activeChatState?.id.endsWith("@g.us")) {
            //     elements.mentioningSuggestion.innerHTML = "<p>Cannot mention outside groups.</p>"
            //     return
            // };
            
            if (!this.messagesContainer) return;
            
            const gpUsrs = await getGroupUsers(this.messagesContainer.chatID);
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
                    this.mention(u);
                    
                    this.messageTextArea.value =
                    this.messageTextArea.value.slice(0, -1) + `@${u.number} `;
                    
                    this.messageTextArea.dispatchEvent(
                        new Event("input", { bubbles: true })
                    );
                    
                    this.mentionSuggestion.classList.add("collapsed");
                    this.messageTextArea.focus();
                });
                
                this.mentionSuggestion.appendChild(contact);
            });
            
        } catch (error) {
            this.mentionSuggestion.innerHTML = "<p>No user was found.</p>";
            
        } finally {
            this.mentionSuggestion.classList.remove("loading");
        }
    }
    
    async sendMessage() {
        if (!this.messagesContainer) return;
        const text = elements.messageInput.value.trim();
        if (!text || !this.messagesContainer) return;
        const _mentionCacheID = this.replyID;
        const _mentionCacheText = this.replyText;
        const chatID = this.messagesContainer?.chatID;
        this.clearMentions()
        this.clearReply()
        
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
        
        
        this.messagesContainer.appendMessage(tempMsg, true);
        ui.scrollToBottom(this.messagesContainer.element);
        
        this.element.dispatchEvent(new CustomEvent('message-dispatch', {
            detail: {
                to: this.messagesContainer.chatID
            }
        }));
        
        try {
            try {
                if (!this.messagesContainer?.chatID.endsWith('@lid')) {
                    await waha.readChat(this.messagesContainer?.chatID);
                }
            } catch (e: any) {
                console.warn('readChat failed (non-fatal):', e.message);
            }
            
            try {
                await waha.startTyping(chatID);
                const delay = Math.min(4000, Math.max(1000, text.length * 50));
                await new Promise(resolve => setTimeout(resolve, delay));
            } catch (e) {
                console.warn('Presence start failed:', e);
            }
            
            try {
                await waha.stopTyping(chatID);
            } catch (e) {
                console.warn('Presence stop failed:', e);
            }
            
            const responseData = await waha.sendTextMessage(chatID, text, this.getMentionedIDs(), _mentionCacheID);            
            this.messagesContainer.replaceMessage(tempMsg.id, responseData);
            
        } catch (error) {
            console.error('Failed to send message:', error);
            const tempBubble = this.messagesContainer.getMessage(tempMsg.id)?.element;
            if (tempBubble) {
                const meta = tempBubble.querySelector('.message-meta');
                if (meta) meta.innerHTML = `<span style="color: #ef4444;">Failed to send</span>`;
            }
        }
    }
    
    async sendFileMessage(file: File) {
        if (!this.messagesContainer) return;
        
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
            
            this.messagesContainer.appendMessage(tempMsg, true);
            ui.scrollToBottom(this.messagesContainer.element);
            
            const result = await waha.sendFileMessage(this.messagesContainer.chatID, file);
            this.messagesContainer.replaceMessage(tempId, result);
            
        } catch (error: any) {
            console.error(error.message);
        }
    }
}