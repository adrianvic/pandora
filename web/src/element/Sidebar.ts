import { BaseComponent } from "./BaseComponent";
import { ChatList } from "./ChatList";

export class Sidebar extends BaseComponent {
    private searchInput: HTMLInputElement;
    private appName: HTMLParagraphElement;
    private userName: HTMLHeadingElement;
    private chatsLoader: HTMLDivElement;
    public readonly chatList: ChatList;

    constructor(el: HTMLElement) {
        super(el);
        this.searchInput = this.query('#chat-search');
        this.appName = this.query('.app-name');
        this.userName = this.query('#pandora-username');
        this.chatsLoader = this.query('#chats-loader');
        this.chatList = new ChatList(this.query('#chat-list'));
        this.bindEvents();
    }

    private bindEvents() {

    }
}