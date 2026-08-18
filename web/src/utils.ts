import type { Message, MessageWithTime } from "./types";

export function formatTime(dateVal: string | number | Date): string {
    if (!dateVal) return '';
    let date: Date;
    if (typeof dateVal === 'number') {
        date = new Date(dateVal < 10000000000 ? dateVal * 1000 : dateVal);
    } else if (typeof dateVal === 'string' && /^\d+$/.test(dateVal)) {
        const num = parseInt(dateVal, 10);
        date = new Date(num < 10000000000 ? num * 1000 : num);
    } else {
        date = new Date(dateVal);
    }
    
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : String(minutes);
    return `${hours}:${minutesStr} ${ampm}`;
}

export function compensateMessageOrdering(messages: Message[]): Message[] {
    if (!Array.isArray(messages)) return [];

    // convert to ms
    const msgs: MessageWithTime[] = messages.map(m => {
        let t: number;
        if (typeof m.timestamp === 'number') {
            t = m.timestamp < 10000000000 ? m.timestamp * 1000 : m.timestamp;
        } else {
            t = new Date(m.timestamp).getTime();
        }
        return { ...m, _time: t };
    });

    msgs.sort((a, b) => a._time - b._time);

    // clean temp property
    return msgs.map(({ _time, ...m }) => m);
}

export function getBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve((reader.result as string).split(",")[1]);
        };

        reader.onerror = (e) => {
            console.error("Error", e);
            reject(e);
        };

        reader.onabort = () => {
            reject(new Error("Aborted"));
        };

        reader.readAsDataURL(file);
    });
}

export function normalizeId(raw: string | { _serialized?: string; user?: string } | null | undefined): string | null {
    if (!raw) return null;
    if (typeof raw === 'object') {
        return raw._serialized || raw.user || JSON.stringify(raw);
    }
    return raw;
}

export function debounce(func: () => void, delay: number): () => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(func, delay);
    };
}
