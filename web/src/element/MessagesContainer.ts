import { getContact } from "../storage";
import { Message } from "../types";
import { BaseComponent } from "./BaseComponent";
import { ChatMessage } from "./ChatMessage";
import { ChatPage } from "./ChatPage";

export class MessagesContainer<T extends HTMLElement = HTMLElement> extends BaseComponent {
    public readonly chatID: string;
    public readonly userID: string;
    public readonly messages: ChatMessage[] = [];
    public readonly chatPage: ChatPage | null;
    
    constructor(elementOrTag: T, chatID: string, userID: string, page: ChatPage | null = null) {
        super(elementOrTag);
        
        this.chatPage = page;
        this.chatID = chatID;
        this.userID = userID;
        
        const loadMore = document.createElement("button");
        loadMore.classList.add("load-more-btn");
        loadMore.innerText = "Load more";
        loadMore.onclick = () => {
            // this.loadMoreMessages(chatId, userID);
        };
        this.element.appendChild(loadMore);
    }
    
    public appendMessage(msg: Message, isLocal = false) {
        const uninplemented: string[] = [
            "e2e_notification",
            "call_log",
            "gp2"
        ]
        
        if (msg._data?.type && uninplemented.indexOf(msg._data?.type) !== -1) return;
        
        const cmsg = new ChatMessage(msg, this, this.chatID, this.userID, isLocal);
        this.messages.push();
        this.element.appendChild(cmsg.element);

        cmsg.element.addEventListener('dblclick', async () => {
            if (!this.chatPage) return;
            const contact = await getContact(msg.id.toString());
            if (!contact) return;
            this.chatPage.mention(contact);
            this.chatPage.messageTextArea?.focus();
        });
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
        const nw = new ChatMessage(to, this, this.chatID, this.userID, isLocal);

        existing.element.after(nw.element);
        existing.destroy();

        this.messages[index] = nw;
    }
}