import { getMoreChatMessages } from "../storage";
import { Message } from "../types";
import { compensateMessageOrdering, matchHeight, subscribeToLongClick } from "../utils";
import { MessageOptionsBar } from "./bar/MessageOptionsBar";
import { BaseComponent } from "./BaseComponent";
import { ChatMessage, WahaChatMessage } from "./ChatMessage";
import { ChatPage } from "./ChatPage";

export class MessagesContainer extends BaseComponent {
    public readonly chatID: string | null;
    public readonly userID: string;
    public readonly messages: ChatMessage[] = [];
    public readonly chatPage: ChatPage | null;
    public readonly loadMore: HTMLElement;
    public messageOptionsBar: MessageOptionsBar | undefined;
    
    constructor(receptacle: HTMLElement, chatID: string | null, userID: string = '', page: ChatPage | null = null) {
        super('div');
        this.element.classList.add('messages-container');
        this.element.id = 'messages-container';
        receptacle.appendChild(this.element);
        
        this.chatPage = page;
        this.chatID = chatID;
        this.userID = userID;
        
        this.loadMore = document.createElement("button");
        this.loadMore.classList.add("load-more-btn", "hidden");
        this.loadMore.innerText = "Load more";
        this.loadMore.onclick = () => {
            this.loadMoreMessages();
        };
        this.element.appendChild(this.loadMore);
    }
    
    public async loadMoreMessages() {
        if (!this.chatID) return;
        const oldest = this.messages[0];
        if (!oldest) return;
        
        const loadMoreButton = this.element.querySelector('.load-more-btn') as HTMLButtonElement;
        loadMoreButton.classList.add('hidden');
        
        const oldestTimestamp = oldest.element.dataset.timestamp;
        const oldestId = oldest.element.dataset.id;
        if (!oldestTimestamp || !oldestId) return;
        
        
        try {
            const raw = await getMoreChatMessages(this.chatID, oldestTimestamp, oldestId);
            const msgs = compensateMessageOrdering(raw);
            
            // API might return the pivot message, so we filter it out
            const filtered = msgs.filter(m => m.id !== oldestId);
            
            const messages: ChatMessage[] = [];
            
            for (let i = 0; i <= filtered.length - 1; i++) {
                const msg = filtered[i];
                const unimplemented: string[] = [];
                if (msg._data?.type && unimplemented.indexOf(msg._data?.type) !== -1) {
                    console.log('Uninplemented message:\n', msg);
                    continue;
                }
                
                const cmsg = new WahaChatMessage(msg, this, this.chatID, this.userID, false, messages[messages.length - 1]);
                messages.push(cmsg);
            }
            
            // we iterate in reverse to maintain order when using after() on the button
            for (let i = messages.length - 1; i >= 0; i --) {
                const cmsg = messages[i];
                this.messages.unshift(cmsg);
                loadMoreButton.after(cmsg.element);
            }
        } catch (error) {
            console.error('Failed to load more messages:', error);
        } finally {
            loadMoreButton.classList.remove('hidden');
        }
    }
    
    public appendMessage(msg: Message, isLocal = false) {
        if (!this.chatID) isLocal = true;
        const unimplemented: string[] = []
        
        if (msg._data?.type && unimplemented.indexOf(msg._data?.type) !== -1) {
            console.log(`Uninplemented message type '${msg._data?.type}':\n`, msg);
            return;
        }
        
        const prev = this.messages[this.messages.length - 1] || null;
        const cmsg = new WahaChatMessage(msg, this, this.chatID || '', this.userID, isLocal, prev);
        
        subscribeToLongClick(cmsg.element, {
            duration: 500,
        })
        
        cmsg.element.addEventListener('long-click', () => this.handleMessageOptions(cmsg))
        cmsg.element.addEventListener('contextmenu', (e) => {
            if (e.target == cmsg.element) return;
            e.preventDefault()
            this.handleMessageOptions(cmsg)
        })
        
        this.messages.push(cmsg);
        this.element.appendChild(cmsg.element);
    }
    
    public handleMessageOptions(cmsg: ChatMessage) {
        if (!this.chatPage) return;

        if (this.messageOptionsBar) {
            this.messageOptionsBar.addManagedMessage(cmsg);
            return;
        }
        
        this.messageOptionsBar = new MessageOptionsBar(cmsg, this);
        this.chatPage?.element.appendChild(this.messageOptionsBar.element);
        this.messageOptionsBar.manage(matchHeight(this.chatPage.messageForm.element, this.messageOptionsBar.element));
        this.messageOptionsBar.show();
        this.messageOptionsBar.element.addEventListener('dispose', () => this.messageOptionsBar = undefined);
    }
    
    public loadBulkMessages(msgs: Message[]) {
        msgs.forEach(msg => this.appendMessage(msg));
    }
    
    public getMessageFromRelativeIndex(cmsg: ChatMessage, offset: number) {
        return this.messages[this.messages.indexOf(cmsg) + offset];
    }
    
    public getMessage(id: string): ChatMessage | undefined {
        return this.messages.find(m => m.id === id);
    }
    
    public replaceMessage(id: string, to: Message, isLocal = false) {
        const existing = this.messages.find(msg => msg.id === id);
        if (!existing) return;
        
        const index = this.messages.indexOf(existing);
        const prev = this.messages[index - 1] || null;
        const nw = new WahaChatMessage(to, this, this.chatID || '', this.userID, isLocal, prev);
        
        existing.element.after(nw.element);
        existing.destroy();
        
        this.messages[index] = nw;
    }
    
    public removeMessage(cmsg: ChatMessage) {
        const index = this.messages.indexOf(cmsg);
        if (index !== -1) {
            this.messages.splice(index, 1);
        }
        cmsg.destroy();
    }
}