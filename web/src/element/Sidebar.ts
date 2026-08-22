import { fetchChats, getChats } from "../storage";
import { Chat } from "../types";
import { BaseComponent } from "./BaseComponent";
import { ChatList } from "./ChatList";

export class Sidebar extends BaseComponent {
    private searchInput: HTMLInputElement;
    private chatsLoader: HTMLDivElement;
    public readonly chatList: ChatList;
    private onChatSelect: ((chat: Chat) => void) | null = null;

    constructor(el: HTMLElement) {
        super(el);
        this.searchInput = this.query('#chat-search');
        this.query('.app-name');
        this.query('#pandora-username');
        this.chatsLoader = this.query('#chats-loader');
        this.chatList = new ChatList(this.query('#chat-list'));
        this.bindEvents();
    }

    private bindEvents() {
        this.searchInput.addEventListener('input', () => {
            const query = this.searchInput.value.toLowerCase();
            const filtered = getChats().filter(chat =>
                chat.name.toLowerCase().includes(query)
            );
            if (this.onChatSelect) {
                this.chatList.renderChatList(filtered, this.onChatSelect);
            }
        });
    }

    public async loadChats(onSelect: (chat: Chat) => void) {
        this.onChatSelect = onSelect;
        this.chatsLoader.classList.remove('hidden');
        try {
            await fetchChats(async () => {
                this.chatList.renderChatList(getChats(), onSelect);
            });
        } catch (error: any) {
            console.error('Failed to load chats:', error);
            this.element.innerHTML = `
                <li class="loading-chats" style="color: var(--text-primary); text-align: center; padding: 20px;">
                    <p>Connection to WAHA failed.</p>
                    <p style="font-size: 0.75rem; color: var(--text-primary); margin-top: 8px;">
                        Ensure WAHA server is running and CORS is enabled, or click Settings to configure.
                    </p>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">${error.message}</p>
                </li>
            `;
        } finally {
            this.chatsLoader.classList.add('hidden');
        }
    }
}