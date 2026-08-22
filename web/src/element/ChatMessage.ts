import { Parser } from "../parser";
import { getMedia, getMessage } from "../storage";
import { Message } from "../types";
import { ui } from "../ui";
import { formatTime, normalizeId } from "../utils";
import { BaseComponent } from "./BaseComponent";
import { ImagePreview } from "./ImagePreview";
import { MessagesContainer } from "./MessagesContainer";

export class ChatMessage extends BaseComponent {
    readonly tick: HTMLElement;
    readonly bubble: HTMLElement;
    public readonly id: string;

    constructor(msg: Message, container: MessagesContainer | null, chatID: string, userID: string, isLocal = false, prevMsg: ChatMessage | null = null) {
        super('div');

        this.id = (msg.id as string); // true blind cast I don't know if it works!!
        
        const isOutgoing = msg.fromMe || msg.sender === 'me';
                
        this.element.className = `message-group selectable ${isOutgoing ? 'outgoing' : 'incoming'}`;
        this.element.id = normalizeId(msg._serialized ? (msg._serialized as any) : msg.id) || "msg-id";
        this.element.dataset.id = msg.id.toString();
        this.element.dataset.timestamp = msg.timestamp?.toString();
        this.element.dataset.from = msg.participant || (msg.from as string);
        
        const senderName = isOutgoing ? userID : (msg._data?.notifyName || (msg.from as string));
        const timeStr = formatTime(msg.timestamp || new Date());
        
        this.tick = document.createElement('span');
	this.tick.classList.add('message-tick');
        this.updateMessageTick(isOutgoing, msg.status);
        
        this.bubble = document.createElement('div');
        this.bubble.className = 'message-bubble';
	if (msg.body == "" || msg.text == "") this.bubble.classList.add("no-text");
        
        let prevUid: string | undefined;
        
        if (msg.participant) {
            prevUid = msg.participant;
        } else {
            prevUid = msg.from as string;
        }
        
        if (!isOutgoing && (!prevMsg || prevUid !== prevMsg.element.dataset.from)) {
            const senderEl = document.createElement('span');
            senderEl.className = 'message-sender';
            senderEl.textContent = senderName;
            this.bubble.appendChild(senderEl);
        }
        
        const contentEl = document.createElement('div');
        contentEl.classList.add('message-content');
        
        if (msg.replyTo) {
            const replyTo = msg.replyTo;
            const replyIndicatorEl = document.createElement("div");
            replyIndicatorEl.classList.add('reply-indicator');
            replyIndicatorEl.textContent = new Parser(replyTo.body || replyTo.text || "")
            .parse('_', '<i>$1</i>')
            .parse('*', '<b>$1</b>')
            .parse('~', '<s>$1</s>')
            .parse('```', '<span style="font-family: monospace;">$1</span>')
            .parse('`', '<code>$1</code>')
            .replace("\n", "<br>")
            .input;
            
            replyIndicatorEl.addEventListener('click', () => {
                const _msg = document.querySelector(`[id*="${replyTo.id}"]`) as HTMLElement;
                if (_msg) {
                    _msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    ui.tempClass(_msg, "mentioned-highlight", 1000);
                }
            });
            
            this.bubble.appendChild(replyIndicatorEl);
        }
        
        const textEl = document.createElement('div');
        const parsed = new Parser(msg.body || msg.text || "")
        .parse('_', '<i>$1</i>')
        .parse('*', '<b>$1</b>')
        .parse('~', '<s>$1</s>')
        .parse('```', '<span style="font-family: monospace;">$1</span>')
        .parse('`', '<code>$1</code>')
        .replace("\n", "<br>")
        .input;
        
        
        textEl.innerHTML = parsed;
        
        const contentAndTime = document.createElement('div');
        contentAndTime.classList.add('message-content-and-time');
        
        contentEl.appendChild(textEl);

        contentAndTime.appendChild(contentEl);
        
        if (msg.hasMedia) {
            let a: HTMLAnchorElement;
            
            if (isLocal) {
                a = ui.generateTempMessageLink(msg);
            } else {
                a = document.createElement('a');
                a.innerText = `[Request media]`;
                a.target = "_blank";
                
                const clickListener = async (e: MouseEvent) => {
                    a.removeEventListener('click', clickListener);
                    a.innerText = `[Downloading]`;
                    const mediaMsg = msg.media ? msg : await getMessage(chatID, normalizeId(msg._serialized ? (msg._serialized as any) : msg.id) || "", true);
                    if (!mediaMsg || !mediaMsg?.media?.url) {
                        a.addEventListener('click', clickListener);
                        a.innerText = `[Error, click to try again]`
                        return;
                    }
                    const url = new URL(mediaMsg.media.url);
                    const reqID = url.pathname.split('/').filter(Boolean).pop();
                    
                    if (!reqID) return;
                    const media = await getMedia(reqID);
                    if (!media) return;
                    
                    const objectUrl = URL.createObjectURL(media.blob);
                    (e.target as HTMLAnchorElement).href = objectUrl;
                                        
                    if (media.blob.type.startsWith('image/')) {
                        this.element.classList.add('preview');
                        this.element.classList.add('image');
                        a.textContent = "";
                        const img = document.createElement('img');
                        img.classList.add('message-image-attachement');
                        img.src = objectUrl;
                        img.onload = () => {
                            if (container) ui.ensureScroll(container.element, () => {});
                        };
                        img.addEventListener('click', () => {
                            const p = new ImagePreview(objectUrl, parsed);
                            container?.chatPage?.element.appendChild(p.element);
                            p.show();
                        })
                        if (container) ui.ensureScroll(container.element, () => {
                            this.bubble.before(img);
                        })
                    } else if (media.blob.type.startsWith('audio')) {
                        this.element.classList.add('preview');
                        this.element.classList.add('audio');
                        a.textContent = "";
                        const audio = document.createElement('audio');
                        audio.classList.add('message-audio-attachement');
                        audio.controls = true;
                        audio.src = objectUrl;
                        if (container) ui.ensureScroll(container.element, () => {
                            this.bubble.before(audio);
                        })
                    } else if (media.blob.type.startsWith('video')) {
                        this.element.classList.add('preview');
                        this.element.classList.add('video');
                        a.textContent = "";
                        const video = document.createElement('video');
                        video.classList.add('message-video-attachement');
                        video.controls = true;
                        video.src = objectUrl;
                        if (container) ui.ensureScroll(container.element, () => {
                            this.bubble.before(video);
                        })
                    } else {
                        (e.target as HTMLAnchorElement).textContent = media.filename || `Download ${mediaMsg.media.filename}`;
                    }
                }
                
                a.addEventListener('click', clickListener);
            }
            
            if (container) ui.ensureScroll(container.element, () => {
                contentEl.appendChild(a);
            });
            
            if (!isLocal && (
                msg._data?.mimetype?.startsWith('image/') ||
                msg._data?.mimetype?.startsWith('audio/') ||
		msg._data?.mimetype?.startsWith('video/')
            ) ) {
                a.click();
            }
        }
        
        const meta = document.createElement('div');
        meta.className = 'message-meta';
        meta.innerHTML = `<span>${timeStr}</span>`;
        meta.appendChild(this.tick);
        
        contentAndTime.appendChild(meta);

        this.bubble.appendChild(contentAndTime);
        
        if (isOutgoing) {
            if (prevMsg && prevMsg.element.classList.contains('outgoing')) {
                this.element.classList.add('same-sender');
            } else {
                const indicator = document.createElement('div');
                indicator.className = 'message-indicator';
                this.element.appendChild(indicator);
            }
        } else if (msg.participant) {
            if (!prevMsg || prevUid !== prevMsg.element.dataset.from) {
                const indicator = document.createElement('div');
                indicator.className = 'message-indicator';
                this.element.appendChild(indicator);
            } else this.element.classList.add('same-sender');
        } else {
            if (!prevMsg || prevUid !== prevMsg.element.dataset.from) {
                const indicator = document.createElement('div');
                indicator.className = 'message-indicator';
                this.element.appendChild(indicator);
            } else this.element.classList.add('same-sender');
        }
        
        this.element.appendChild(this.bubble);

        this.bubble.addEventListener('dblclick', () => {
            if (container?.chatPage) {
                container.chatPage.setReply(msg.id.toString(), parsed);
                container.chatPage.messageTextArea?.focus();
            }
        });
    }
    
    updateMessageTick(isOutgoing: boolean, status: string | undefined) {
        this.tick.style.width = "14px";
        this.tick.style.height = "14px";

        if (isOutgoing) {
            if (status === 'read') {
                this.tick.classList = "mif-done_all";
                this.tick.style.color = "var(--online-color)";
            } else if (status === 'delivered') {
                this.tick.classList = "mif-done";
            } else if (status === 'sending') {
                this.tick.classList = "mif-earth";
            } else {
                this.tick.classList = "mif-done";
            }
        }
    }
}
