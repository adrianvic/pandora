import { Chat, Contact } from "./types";
import { elements } from "./ui";

export let activeChatState: Chat | null = null;
export let mentionCacheID: string | null = null;
export let mentionCacheText: string | null = null;
export let mentionedContacts: Contact[] = [];

export function setActiveChatState(value: Chat | null) {
    activeChatState = value;
}

export function prepareMention(id: string, text: string) {
    mentionCacheID = id;
    mentionCacheText = text;
    const span = elements.mentioningIndicator.querySelector('span');
    if (span) span.innerText = `Mentioning "${text}".`;
    elements.mentioningIndicator.classList.remove('collapsed');
}

export function clearMentionCache() {
    mentionCacheID = null;
    mentionCacheText = null;
    const span = elements.mentioningIndicator.querySelector('span');
    if (span) span.innerText = '';
    elements.mentioningIndicator.classList.add('collapsed');
}

export function mentionedContact(contact: Contact) {
    mentionedContacts.push(contact);
}

export function clearMentionedContacts() {
    mentionedContacts = [];
}

export function removeMentionedContact(contact: Contact) {
    const index = mentionedContacts.indexOf(contact);
    if (index === -1) return;
    mentionedContacts.splice(index, 1);
}

export function getMentionedIDs(): string[] {
    const m = mentionedContacts.map(x => x.id);
    const r: string[] = [];
    m.forEach(_m => { if (_m) r.push(_m) })

    return r;
}