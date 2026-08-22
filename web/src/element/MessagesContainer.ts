import { getMoreChatMessages } from "../storage";
import { Message } from "../types";
import { compensateMessageOrdering } from "../utils";
import { BaseComponent } from "./BaseComponent";
import { ChatMessage } from "./ChatMessage";
import { ChatPage } from "./ChatPage";

export class MessagesContainer extends BaseComponent {
    public readonly chatID: string;
    public readonly userID: string;
    public readonly messages: ChatMessage[] = [];
    public readonly chatPage: ChatPage | null;
    public readonly loadMore: HTMLElement;
    
    constructor(receptacle: HTMLElement, chatID: string, userID: string, page: ChatPage | null = null) {
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
                const unimplemented = ["e2e_notification", "call_log", "gp2"];
                if (msg._data?.type && unimplemented.indexOf(msg._data?.type) !== -1) continue;

                const cmsg = new ChatMessage(msg, this, this.chatID, this.userID, false, messages[messages.length - 1]);
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
        const unimplemented: string[] = [
            "e2e_notification",
            "call_log",
            "gp2"
        ]
        
        if (msg._data?.type && unimplemented.indexOf(msg._data?.type) !== -1) return;
        
        const prev = this.messages[this.messages.length - 1] || null;
        const cmsg = new ChatMessage(msg, this, this.chatID, this.userID, isLocal, prev);
        this.messages.push(cmsg);
        this.element.appendChild(cmsg.element);
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
        const nw = new ChatMessage(to, this, this.chatID, this.userID, isLocal, prev);

        existing.element.after(nw.element);
        existing.destroy();

        this.messages[index] = nw;
    }
}