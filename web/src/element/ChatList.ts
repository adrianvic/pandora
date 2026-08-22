import { loadLatestMessages } from "../db";
import { getChatPicture } from "../storage";
import { Chat, Message } from "../types";
import { formatTime, normalizeId } from "../utils";
import { BaseComponent } from "./BaseComponent";

export class ChatList extends BaseComponent {
    chats = new Map<Chat, HTMLElement>;
    onChatSelect: (chat: Chat) => void;
    
    constructor(element: HTMLUListElement, onChatSelect: (chat: Chat) => void) {
        super(element);
        this.onChatSelect = onChatSelect;
    }
    
    renderChatList(chats: Chat[], onChatSelect = this.onChatSelect) {
        this.element.innerHTML = '';
        this.chats.clear();

        chats.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            if (a.archived !== b.archived) {
                return a.archived ? 1 : -1;
            }
            return timeB - timeA;
        });
        
        if (chats.length === 0) {
            this.element.innerHTML = `<li class="loading-chats">No chats found</li>`;
            return;
        }
        
        chats.forEach(async c => await this.renderSingleEntry(c, onChatSelect));
    }
    
    public async renderSingleEntry(chat: Chat, onChatSelect: (chat: Chat) => void) {
        if (chat.timestamp == null) return;
        const li = document.createElement('li');
        li.className = "chat-item selectable";
        li.dataset.id = chat.id;
        if (chat.archived) li.classList.add('archived'); 
        
        const initials = chat.name ? chat.name.substring(0, 1).toUpperCase() : '?';
        const hasUnread = chat.unreadCount && chat.unreadCount > 0;
        const timeStr = formatTime(chat.timestamp || new Date());
        
        let lastMessage = chat.lastMessage || '...';
        
        const retrievedLastMesssage = await loadLatestMessages(chat.id, 2);
        
        if (!retrievedLastMesssage[0]) return;
        
        // in this case the user probably deleted the chat, but wpp still includes that pesky e2e notification
        if (retrievedLastMesssage[0]._data?.type === 'e2e_notification' && !retrievedLastMesssage[1]) return;
        
        if (retrievedLastMesssage[0]._data?.type === 'sticker') lastMessage = "<i>Sticker</i>";
        if (retrievedLastMesssage[0]._data?.type === 'call_log') lastMessage = "<i>A call was made</i>";
        if (retrievedLastMesssage[0]._data?.type === 'image') lastMessage = "<i>Image</i>";
        if (retrievedLastMesssage[0]._data?.type === 'video') lastMessage = "</i>Video</i>";
        if (retrievedLastMesssage[0]._data?.type === 'e2e_notification') lastMessage = "</i>Encryption key has changed</i>";
        if (retrievedLastMesssage[0]._data?.type === 'gp2') lastMessage = "<i>Group changed</i>";
        
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
                    ${lastMessage}
                  </span>
                  ${hasUnread ? `${this.generateChatBadge(chat.unreadCount).outerHTML}` : ''}
                </div>
              </div>
            `;
        
        li.addEventListener('click', () => onChatSelect(chat));
        this.element.appendChild(li);
        this.chats.set(chat, li);
        
        (async () => {
            try {
                const picture = await getChatPicture(chat.id);
                const img = li.querySelector(`img[data-chat-avatar="${chat.id}"]`) as HTMLImageElement;
                if (img) img.src = picture.url ? picture.url : '';
            } catch (e) {
            }
        })();
    }
    
    private generateChatBadge(count: number): HTMLSpanElement {
        const badge = document.createElement('span') as HTMLSpanElement;
        badge.classList.add('unread-badge');
        
        badge.innerText = count.toString();
        
        return badge;
    }
    
    updateChatBadge(chatId: string, count: number) {
        const li = this.element.querySelector(`li[data-id='${chatId}']`);
        const newBadge = this.generateChatBadge(count);
        const badge = li?.querySelector('.unread-badge');
        if (badge) {
            if (count === 0) {
                badge.remove();
            } else {
                badge.textContent = count.toString();
            }
        } else if (count > 0) {
            const preview = this.element.querySelector(`li[data-id='${chatId}'] .chat-item-preview`);
            if (preview) {
                preview.appendChild(newBadge);
            } else {
                console.log("[ChatList#updateBadge] Didn't find chat with id " + chatId);
            }
        }
    }
    
    updateItemFromMessage(msg: Message) {
        const rawChatId = msg.chatId || (typeof msg.from === 'string' ? msg.from : (msg.from as any)?._serialized) || (msg.chat && msg.chat.id);
        const chatId = normalizeId(rawChatId);
        if (!chatId) return;

        const isIncoming = !msg.fromMe && msg.sender !== 'me';
        this.updateItem(chatId, msg.body ?? msg.text ?? "", msg.timestamp.toString(), isIncoming ? 1 : 0);
    }
    
    updateItemFromChat(chat: Chat) {
        this.updateItem(chat.id, chat.lastMessage, chat.timestamp.toString(), 1);
    }
    
    updateItem(chatId: string, preview: string, timestamp: string, incrementCount: number) {
        const entry = [...this.chats].find(([key]) => key.id === chatId);
        if (!entry) return;

        const [chat, chatNode] = entry;
        chat.lastMessage = preview;
        chat.timestamp = timestamp;

        if (chatNode) {
            const messageItem = chatNode.querySelector('.chat-item-msg') as HTMLElement;
            messageItem.innerText = preview;
            
            const time = chatNode.querySelector('.chat-item-time') as HTMLElement;
            time.innerText = formatTime(timestamp);
            
            const unreadBadge = chatNode.querySelector('.unread-badge') as HTMLElement;
            let count = 0;
            if (unreadBadge) count = parseFloat(unreadBadge.innerText);
            if (Number.isNaN(count)) count = 0;
            this.updateChatBadge(chatId, count + incrementCount);

            this.resort();
        }
    }
    
    archiveChat(chatID: string, archive = true) {
        const entry = [...this.chats].find(([key]) => key.id === chatID);
        if (entry) {
            const [chat, chatNode] = entry;
            chat.archived = archive;
            archive ? chatNode.classList.add('archived') : chatNode.classList.remove('archived');
            this.resort();
        }
    }
    
    resort() {
        const sortedMap = new Map(
            [...this.chats].sort(([a], [b]) => {
                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                if (a.archived !== b.archived) {
                    return a.archived ? 1 : -1;
                }
                return timeB - timeA;
            })
        );

        this.chats = sortedMap;

        this.element.innerHTML = '';
        sortedMap.forEach((node) => {
            this.element.appendChild(node);
        });
    }
}