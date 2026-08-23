import { Contact } from "../types";
import { ui } from "../ui";
import { sleep } from "../utils";
import { BaseComponent } from "./BaseComponent";
import { ChatMessage } from "./ChatMessage";
import { MessageForm } from "./MessageInput";
import { MessagesContainer } from "./MessagesContainer";

export class AttachmentScreen extends BaseComponent {
    messageForm: MessageForm;
    mentioned: Contact[] = [];
    messagesContainer: MessagesContainer;
    typing: any;
    attachmentButton: HTMLButtonElement;
    attachmentInput: HTMLInputElement;
    activeChatState: HTMLDivElement;
    messagesContainerReceptacle: HTMLDivElement;
    private readonly files = new Map<File, string>;
    
    constructor() {
        super('div');
        this.element.classList.add('attachment-screen');
        
        this.element.style.transition = 'transform 400ms cubic-bezier(0.19, 1, 0.22, 1)';
        this.element.style.transform = 'translateY(100%)';
        super.setVisibility(false);
        
        this.messageForm = new MessageForm(() => {
            this.finish();
        }, false, true);
        
        this.messageForm.textArea.placeholder = 'Type a caption...'
        this.messageForm.sendButton.classList.remove('mif-paper-plane');
        this.messageForm.sendButton.classList.add('mif-done_all');
        
        const extraButtons = document.createElement('div');
        extraButtons.classList = 'input-actions-left';
        extraButtons.innerHTML = `
        <button class="chat-footer-btn icon-btn mif-attachment mif-3x attachment-btn" title="Add attachment"></button>
        <button class="chat-footer-btn icon-btn mif-cross-light mif-3x close-btn" title="Cancel"></button>
        <input class="attachment-input" style="display: none;" type="file">`
        this.messageForm.form.before(extraButtons);
        
        this.attachmentInput = extraButtons.querySelector('.attachment-input') as HTMLInputElement;
        this.attachmentButton = extraButtons.querySelector('.attachment-btn') as HTMLButtonElement;
        this.attachmentButton.addEventListener('mousedown', this.messageForm.preventFocusLoss);
        
        this.attachmentInput.addEventListener('change', (e) => {
            const firstFile = (e.target as HTMLInputElement).files?.[0];
            if (firstFile) this.addFile(firstFile);
        });
        
        this.attachmentButton.addEventListener('click', () => {
            this.pickFile()
        });
        
        const closeButton = extraButtons.querySelector('.close-btn') as HTMLButtonElement;
        
        closeButton.addEventListener('click', () => {
            this.destroy()
        })
        
        this.activeChatState = document.createElement('div');
        this.activeChatState.classList = 'active-chat-container';
        this.activeChatState.id = 'active-chat-container';
        
        this.messagesContainerReceptacle = document.createElement('div');
        this.messagesContainerReceptacle.style.flex = "1";
        this.messagesContainerReceptacle.style.overflow = "hidden";
        this.messagesContainerReceptacle.style.display = "flex";
        this.messagesContainerReceptacle.style.flexDirection = "column";
        
        this.messagesContainer = new MessagesContainer(this.messagesContainerReceptacle, null, 'me');


        const message = document.createElement('div');
        message.classList = 'message-group selectable neutral';
        message.innerText = "Click the 'add attachment' button to prepare a new attachment";

        this.messagesContainer.element.appendChild(message);
        
        this.activeChatState.appendChild(this.messagesContainer.element);
        this.activeChatState.appendChild(this.messageForm.element);
        
        this.element.appendChild(this.activeChatState);
    }
    
    addFile(file: File) {
        this.files.set(file, this.messageForm.textArea.value);
        
        try {
            const tempId = 'temp-' + Date.now();
            console.log(file.type)
            let type = "document";
            if (file.type.startsWith('image/')) type = "image";
            if (file.type.startsWith('video/')) type = "video";
            if (file.type.startsWith('audio/')) type = "audio";
            
            const prev = this.messagesContainer.messages[this.messagesContainer.messages.length - 1] || null;
            const cmsg = new ChatMessage({
                id: tempId,
                body: this.messageForm.textArea.value,
                timestamp: new Date(),
                from: 'me',
                fromMe: true,
                status: 'sending',
                hasMedia: true,
                media: {
                    url: URL.createObjectURL(file),
                    filename: file.name
                },
                type: type
            }, this.messagesContainer, prev);

            this.messagesContainer.messages.push(cmsg);
            this.messagesContainer.element.appendChild(cmsg.element);

            ui.scrollToBottom(this.messagesContainer.element);
            
        } catch (error: any) {
            console.error(error.message);
        }
    }
    
    pickFile() {
        this.attachmentInput.click();
    }
    
    finish() {
        if (!confirm('Are you sure you want to send these attachments?')) return;
        this.element.style.pointerEvents = 'none';
        
        this.element.dispatchEvent(new CustomEvent('finished-composing',
            {
                detail: {
                    files: this.files
                }
            }
        ));
        
        this.destroy();
    }
    
    override async destroy(): Promise<void> {
        await this.setVisibility(false);
        super.destroy();
    }
    
    override async setVisibility(visible: boolean): Promise<void> {
        if (visible) {
            super.setVisibility(true);
            
            void this.element.offsetWidth;
            
            this.element.style.transform = 'translateY(0)';
        } else {
            this.element.style.transform = 'translateY(100%)';
            
            await sleep(400);
            super.setVisibility(false);
        }
    }
}