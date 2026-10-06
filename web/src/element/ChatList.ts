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
        
        chats.forEach(async c => {
            await this.renderSingleEntry(c, onChatSelect);
        });
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
        
        
        const retrievedLastMesssage = await loadLatestMessages(chat.id, 2);
        
        if (!retrievedLastMesssage[0]) return;
        
        // console.log(`${chat.name} ${retrievedLastMesssage[0]._data?.type}`)
        
        // in this case the user probably deleted the chat, but wpp still includes that pesky e2e notification
        if (retrievedLastMesssage[0]._data?.type === 'e2e_notification' && !retrievedLastMesssage[1]) return;
        
        let lastMessage = this.renderPreviewFromMessage(retrievedLastMesssage[0], chat.lastMessage);

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
                  <span class="chat-item-msg" data-chatid="${chat.id}" title="${lastMessage}">
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

    private renderPreviewFromMessage(message: Message, def = '') {
        let lastMessage = def;

        const special = ['sticker', 'call_log', 'image', 'video', 'e2e_notification', 'gp2', 'document', 'groups_v4_invite', 'poll_creation', 'notification_template', 'revoked', 'ptt']

        if (message._data?.type === 'sticker') lastMessage = "Sticker";
        if (message._data?.type === 'call_log') lastMessage = "A call was made";
        if (message._data?.type === 'image') lastMessage = "Image";
        if (message._data?.type === 'video') lastMessage = "Video";
        if (message._data?.type === 'e2e_notification') lastMessage = "Encryption key has changed";
        if (message._data?.type === 'gp2') lastMessage = "Group changed";
        if (message._data?.type === 'document') lastMessage = `Document`;
        if (message._data?.type === 'groups_v4_invite') lastMessage = `Group invite`;
        if (message._data?.type === 'poll_creation') lastMessage = `Poll`;
        if (message._data?.type === 'notification_template') lastMessage = `Unsupported message`;
        if (message._data?.type === 'revoked') lastMessage = `Deleted message`;
        if (message._data?.type === 'ptt') lastMessage = `Audio`;
        
        if (special.indexOf(message._data?.type ?? "") !== -1) {
            lastMessage = `<span class='internal-message-preview'><i>${lastMessage}</i></span>`;
        }

        if (message.body === '' && message.body === lastMessage) {
            lastMessage += `${message.body === '' ? '' : ": " + message.body}`
        };

        return lastMessage;
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
        const isIncoming = !msg.fromMe && msg.sender !== 'me';

        const rawChatId = isIncoming
        ? (
            msg.chatId ??
            (typeof msg.from === 'string'
                ? msg.from
                : (msg.from as any)?._serialized) ??
            msg.chat?.id
        )
        : (
            msg.chatId ??
            (typeof (msg as any).to === 'string'
                ? (msg as any).to
                : (msg as any).to?._serialized) ??
            msg.chat?.id
        );

        const chatId = normalizeId(rawChatId);
        if (!chatId) return;

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