import { Parser } from "../parser";
import { getMedia, getMessage, getContact, deleteMessage } from "../storage";
import { Message } from "../types";
import { ui } from "../ui";
import { formatTime, normalizeId } from "../utils";
import { AudioPlayer } from "./AudioPlayer";
import { BaseComponent } from "./BaseComponent";
import { ImagePreview } from "./ImagePreview";
import { MessagesContainer } from "./MessagesContainer";
import { config } from "../config";
import { waha } from "../waha";

export interface ChatMessageOptions {
    id: string;
    body: string;
    timestamp: number | string | Date;
    from: string;
    fromMe: boolean;
    senderName?: string;
    status?: string;
    hasMedia?: boolean;
    media?: {
        url: string;
        filename?: string;
    };
    type?: string;
    replyTo?: {
        id: string;
        body: string;
    };
    isGroup?: boolean;
}

export class ChatMessage extends BaseComponent {
    readonly tick: HTMLElement;
    readonly bubble: HTMLElement;
    public readonly id: string;
    public readonly isOutgoing: boolean;
    public readonly isGroup: boolean;
    protected container: MessagesContainer | null;
    public readonly content: HTMLElement;
    public readonly from: string;

    constructor(options: ChatMessageOptions, container: MessagesContainer | null = null, prevMsg: ChatMessage | null = null) {
        super('div');
        this.container = container;
        this.id = options.id;
        this.isOutgoing = options.fromMe;
        this.isGroup = options.isGroup ?? true;
        this.from = options.from;

        this.element.id = `msg-${options.id}`;
        this.element.dataset.id = options.id;
        this.element.dataset.timestamp = options.timestamp.toString();
        this.element.dataset.from = options.from;

        const timeStr = formatTime(options.timestamp);
        
        this.tick = document.createElement('span');
        this.tick.classList.add('message-tick');
        this.updateMessageTick(options.status);

        const parsed = this.parseText(options.body, options.type);

        this.bubble = document.createElement('div');
        this.bubble.className = 'message-bubble';
        if (options.body === "") this.bubble.classList.add("no-text");
        this.element.appendChild(this.bubble);

        this.renderSenderName(options, prevMsg);
        this.renderReply(options);

        const contentAndTime = document.createElement('div');
        contentAndTime.classList.add('message-content-and-time');

        const contentEl = document.createElement('div');
        contentEl.classList.add('message-content');
        this.content = contentEl;

        const textEl = document.createElement('div');
        textEl.innerHTML = parsed;
        contentEl.appendChild(textEl);

        contentAndTime.appendChild(contentEl);

        const meta = document.createElement('div');
        meta.className = 'message-meta';
        meta.innerHTML = `<span>${timeStr}</span>`;
        meta.appendChild(this.tick);
        contentAndTime.appendChild(meta);

        this.bubble.appendChild(contentAndTime);

        this.renderMedia(options, parsed);

        this.applyStyling(options, prevMsg);

        this.bubble.addEventListener('dblclick', (e) => {
            if (e.target !== this.bubble && e.target !== contentAndTime) return;
            if (this.container?.chatPage) {
                this.container.chatPage.setReply(this.id, parsed);
                this.container.chatPage.messageForm.textArea?.focus();
            }
        });
    }

    protected parseText(body: string, type?: string): string {
        const neutral = ["e2e_notification", "call_log", "gp2"];
        if (type && neutral.includes(type)) {
            this.element.className = `message-group selectable neutral`;
            if (type === "e2e_notification") return 'This chat encryption key has changed';
            if (type === "call_log") return 'A call was made';
            if (type === "gp2") return 'This group description was changed';
        }

        this.element.className = `message-group selectable ${this.isOutgoing ? 'outgoing' : 'incoming'}`;
        if (type === 'sticker') this.element.classList.add('sticker');
        if (type === 'revoked') return '<i>This message was deleted</i>';

        return new Parser(body)
            .parse('_', '<i>$1</i>')
            .parse('*', '<b>$1</b>')
            .parse('~', '<s>$1</s>')
            .parse('```', '<span style="font-family: monospace;">$1</span>')
            .parse('`', '<code>$1</code>')
            .replace("\n", "<br>")
            .input;
    }

    protected renderSenderName(options: ChatMessageOptions, prevMsg: ChatMessage | null) {
        if (!this.isOutgoing && (!prevMsg || options.from !== prevMsg.element.dataset.from)) {
            const senderEl = document.createElement('span');
            senderEl.className = 'message-sender';
            senderEl.textContent = options.senderName || options.from;
            if (this.isGroup) this.bubble.appendChild(senderEl);

            if ((senderEl.textContent.includes('@lid') || senderEl.textContent.includes('@c.us')) && !options.senderName) {
                getContact(options.from).then(contact => {
                    if (contact && (contact.name || contact.pushname)) {
                        senderEl.textContent = contact.name || contact.pushname;
                    }
                });
            }
        }
    }

    protected renderReply(options: ChatMessageOptions) {
        if (options.replyTo) {
            const replyIndicatorEl = document.createElement("div");
            replyIndicatorEl.classList.add('reply-indicator');
            replyIndicatorEl.innerHTML = new Parser(options.replyTo.body)
                .parse('_', '<i>$1</i>')
                .parse('*', '<b>$1</b>')
                .parse('~', '<s>$1</s>')
                .parse('```', '<span style="font-family: monospace;">$1</span>')
                .parse('`', '<code>$1</code>')
                .replace("\n", "<br>")
                .input;
            
            const replyId = options.replyTo.id;
            replyIndicatorEl.addEventListener('click', () => {
                const _msg = document.querySelector(`[id*="${replyId}"]`) as HTMLElement;
                if (_msg) {
                    _msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    ui.tempClass(_msg, "mentioned-highlight", 1000);
                }
            });
            this.bubble.appendChild(replyIndicatorEl);
        }
    }

    protected renderMedia(options: ChatMessageOptions, parsedText: string) {
        if (!options.hasMedia || !options.media?.url) return;

        const url = options.media.url;
        // const mime = options.type || ''; // Assuming type might hold mime for generic messages if needed, or we just check extension

        // Generic detection if not provided by subclass
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$|^blob:/i) || options.type === 'image') {
            this.renderImage(url, parsedText);
        } else if (url.match(/\.(mp4|webm|ogg)$/i) || options.type === 'video') {
            this.renderVideo(url);
        } else if (url.match(/\.(mp3|wav|ogg|m4a)$/i) || options.type === 'audio') {
            this.renderAudio(url);
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.target = "_blank";
            a.textContent = options.media.filename || "Download file";
            a.download = options.media.filename || "file";
            this.bubble.querySelector('.message-content')?.appendChild(a);
        }
    }

    protected renderImage(url: string, caption: string) {
        this.element.classList.add('preview', 'image');
        const img = document.createElement('img');
        img.classList.add('message-image-attachement');
        img.src = url;
        img.onload = () => {
            if (this.container) ui.ensureScroll(this.container.element, () => {});
        };
        img.addEventListener('click', () => {
            const p = new ImagePreview(url, caption);
            this.container?.chatPage?.element.appendChild(p.element);
            p.show();
        });

        if (this.container) {
            ui.ensureScroll(this.container.element, () => {
                this.bubble.before(img);
            });
        } else {
            this.bubble.before(img);
        }
    }

    protected renderVideo(url: string) {
        this.element.classList.add('preview', 'video');
        const video = document.createElement('video');
        video.classList.add('message-video-attachement');
        video.controls = true;
        video.src = url;

        if (this.container) {
            ui.ensureScroll(this.container.element, () => {
                this.bubble.before(video);
            });
        } else {
            this.bubble.before(video);
        }
    }

    protected renderAudio(url: string) {
        this.element.classList.add('preview', 'audio');
        const audio = new AudioPlayer(url);

        if (this.container) {
            ui.ensureScroll(this.container.element, () => {
                this.bubble.before(audio.element);
            });
        } else {
            this.bubble.before(audio.element);
        }
    }

    protected applyStyling(options: ChatMessageOptions, prevMsg: ChatMessage | null) {
        const isNeutral = this.element.classList.contains('neutral');
        if (!isNeutral) {
            const currentFrom = options.from;
            const prevFrom = prevMsg?.element.dataset.from;
            const sameSender = prevMsg &&
                             prevFrom === currentFrom &&
                             prevMsg.isOutgoing === this.isOutgoing &&
                             !prevMsg.element.classList.contains('neutral');

            if (sameSender) {
                this.element.classList.add('same-sender');
            } else {
                const indicator = document.createElement('div');
                indicator.className = 'message-indicator';
                this.element.firstChild?.before(indicator);
            }
        }
    }

    updateMessageTick(status: string | undefined) {
        this.tick.style.width = "14px";
        this.tick.style.height = "14px";

        if (this.isOutgoing) {
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

export class WahaChatMessage extends ChatMessage {
    constructor(msg: Message, container: MessagesContainer | null, chatID: string, userID: string, isLocal = false, prevMsg: ChatMessage | null = null) {
        const options: ChatMessageOptions = {
            id: msg.id.toString(),
            body: msg.body || msg.text || "",
            timestamp: msg.timestamp,
            from: (msg.participant || msg.from || "") as string,
            fromMe: msg.fromMe || msg.sender === 'me',
            senderName: (msg.fromMe || msg.sender === 'me') ? userID : (msg._data?.notifyName || msg.participant || (msg.from as string)),
            status: msg.status,
            hasMedia: msg.hasMedia,
            type: msg._data?.type,
            isGroup: msg.sender?.endsWith('@g.us') ?? msg.from?.endsWith('@g.us') ?? true,
            replyTo: msg.replyTo ? {
                id: msg.replyTo.id.toString(),
                body: msg.replyTo.body || msg.replyTo.text || ""
            } : undefined
        };

        if (msg.hasMedia && msg.media) {
            let url = msg.media.url;
            if (url && url.startsWith('/')) {
                url = `${config.wahaUrl}${url}`;
            }
            options.media = {
                url: url,
                filename: msg.media.filename
            };
        }

        super(options, container, prevMsg);

        this.element.addEventListener('delete', () => {
            deleteMessage(this.from, this.id);
        })

        // Handle async WAHA media fetching if not local
        if (msg.hasMedia && !isLocal && !msg.media?.url) {
            this.setupWahaMediaDownloader(msg, chatID);
        }
    }

    private setupWahaMediaDownloader(msg: Message, chatID: string) {
        const contentEl = this.bubble.querySelector('.message-content');
        if (!contentEl) return;

        const a = document.createElement('a');
        a.innerText = `[Request media]`;
        a.href = "#";
        a.style.display = "block";
        contentEl.appendChild(a);

        const clickListener = async (e: MouseEvent) => {
            e.preventDefault();
            a.removeEventListener('click', clickListener);
            a.innerText = `[Downloading]`;

            try {
                const mediaMsg = msg.media ? msg : await getMessage(chatID, normalizeId(msg._serialized ? (msg._serialized as any) : msg.id) || "", true);
                if (!mediaMsg || !mediaMsg?.media?.url) {
                    a.addEventListener('click', clickListener);
                    a.innerText = `[Error, click to try again]`;
                    return;
                }

                const url = new URL(mediaMsg.media.url);
                const reqID = url.pathname.split('/').filter(Boolean).pop();
                if (!reqID) return;

                const media = await getMedia(reqID);
                if (!media) return;

                const objectUrl = URL.createObjectURL(media.blob);
                a.remove(); // Remove the link once we have media

                const parsed = this.parseText(msg.body || msg.text || "", msg._data?.type);

                if (media.blob.type.startsWith('image/')) {
                    this.renderImage(objectUrl, parsed);
                } else if (media.blob.type.startsWith('audio/')) {
                    this.renderAudio(objectUrl);
                } else if (media.blob.type.startsWith('video/')) {
                    this.renderVideo(objectUrl);
                } else {
                    const downloadLink = document.createElement('a');
                    downloadLink.href = objectUrl;
                    downloadLink.target = "_blank";
                    downloadLink.textContent = media.filename || "Download file";
                    downloadLink.download = media.filename || "file";
                    contentEl.appendChild(downloadLink);
                }
            } catch (err) {
                console.error("Media download failed", err);
                a.innerText = `[Download failed]`;
            }
        };

        a.addEventListener('click', clickListener);

        // Auto-click for certain types if needed (matching original behavior)
        if (msg._data?.mimetype?.startsWith('image/') ||
            msg._data?.mimetype?.startsWith('audio/') ||
            msg._data?.mimetype?.startsWith('video/')) {
            a.click();
        }
    }
}
