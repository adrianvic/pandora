import { Chat } from "./types";

export let activeChatState: Chat | null = null;

export function setActiveChatState(value: Chat | null) {
    activeChatState = value;
}