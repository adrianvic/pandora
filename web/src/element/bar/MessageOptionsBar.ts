import { sleep } from "../../utils";
import { ChatMessage } from "../ChatMessage";
import { MessagesContainer } from "../MessagesContainer";
import { BottomBar } from "./BottomBar";
import { BottomBarButton } from "./BottomBarButton";

export class MessageOptionsBar extends BottomBar {
    private readonly messages: ChatMessage[] = [];
    private container: MessagesContainer;

    constructor(msg: ChatMessage, container: MessagesContainer) {
        super([
            new BottomBarButton('delete', 'cross-light', () => { this.deleteMessage() })
        ]);

        this.container = container;
        this.element.classList.add('message-options-bar');
        this.addManagedMessage(msg);
        
        this.element.addEventListener('click', (e) => {
            if (e.target == this.element) this.destroy();
        })

        super.show();
    }

    deleteMessage() {
        if (!confirm('Do you want to delete this message?')) return;

        this.messages.forEach(msg => {
            msg.element.dispatchEvent(new CustomEvent('delete'));
            this.container.removeMessage(msg);
        });

        super.destroy()
    }

    async addManagedMessage(msg: ChatMessage) {
        if (msg.element.classList.contains('neutral')) return;
        msg.element.classList.add('selected');
        this.messages.push(msg);

        await sleep(1000); // or else the event listener below will trigger instantly

        msg.element.addEventListener('click', () => this.unselect(msg), {
            once: true
        })
    }

    unselect(msg: ChatMessage) {
        const i = this.messages.indexOf(msg);
        if (i === -1) return;
        const rm = this.messages[i];
        rm.element.classList.remove('selected');
        this.messages.splice(i, 1);
        if (this.messages.length === 0) this.destroy();
    }

    override async destroy(): Promise<void> {
        this.messages.forEach(msg => msg.element.classList.remove('selected'));
        await super.destroy();
    }
}