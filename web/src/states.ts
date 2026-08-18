import { Chat } from "./types";
import { elements } from "./ui";

export let activeChatState: Chat | null = null;
export let mentionCacheID: string | null = null;
export let mentionCacheText: string | null = null;

export function setActiveChatState(value: Chat | null) {
    activeChatState = value;
}

export function prepareMention(id: string, text: string) {
    mentionCacheID = id;
    mentionCacheText = text;
    elements.mentioningIndicator.innerText = `Mentioning "${text}".`;
    elements.mentioningIndicator.classList.remove('collapsed');
}

export function clearMentionCache() {
    mentionCacheID = null;
    mentionCacheText = null;
    elements.mentioningIndicator.innerText = ``;
    elements.mentioningIndicator.classList.add('collapsed');
}