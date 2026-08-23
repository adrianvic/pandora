import { ui } from "../ui";
import { BaseComponent } from "./BaseComponent";

export class MessageForm extends BaseComponent {
    public readonly form: HTMLFormElement;
    public readonly textArea: HTMLTextAreaElement;
    public readonly sendButton: HTMLButtonElement
    
    constructor(onResult: (text: string, e: SubmitEvent) => void, sendOnEnter = true, clearOnSubmit: boolean = true) {
        super('div');
        
        this.element.classList.add('chat-input-panel');
        this.element.id = "chat-input-panel";
        this.element.innerHTML =
        ``;
        
        this.form = document.createElement('form');
        this.form.classList.add('input-form');
        this.form.id = 'message-form';
        
        this.textArea = document.createElement('textarea');
        this.textArea.id = 'message-input';
        this.textArea.rows = 1;
        this.textArea.placeholder = "Type a message...";
        this.textArea.autocomplete = 'off';
        
        this.sendButton = document.createElement('button');
        this.sendButton.type = 'submit';
        this.sendButton.className = 'chat-footer-btn send-btn mif-paper-plane mif-3x';
        this.sendButton.id = 'send-button';
        
        this.form.appendChild(this.textArea);
        this.form.appendChild(this.sendButton);
        this.element.appendChild(this.form);
        
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            onResult(this.textArea.value, e);
            if (clearOnSubmit) this.textArea.value = '';
        });

        if (sendOnEnter) {
            this.textArea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.form.submit();
                }
            });
        }
        
        this.sendButton.addEventListener('mousedown', this.preventFocusLoss);
        
        ui.autoResizeTextArea(this.textArea);
    }
    
    // Prevent focus loss when clicking these buttons (keeps keyboard open on mobile)
    public preventFocusLoss = (e: MouseEvent | TouchEvent) => {
        if (document.activeElement === this.textArea) {
            e.preventDefault();
            
            // If it's a touch event, preventing default will also prevent the click.
            // We manually trigger the click action for these specific buttons if needed,
            // but usually mousedown preventDefault is enough for Android.
            // If you use touchstart, you'd need to manually call this.sendMessage() or toggle the bar here.
        }
    };
}