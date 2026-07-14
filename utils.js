// Helper utilities and algorithms

/**
 * Format timestamps (supports Unix epoch seconds/ms, strings and ISO dates)
 * @param {string|number|Date} dateVal 
 * @returns {string} Formatted HH:MM AM/PM string
 */
export function formatTime(dateVal) {
    if (!dateVal) return '';
    let date;
    if (typeof dateVal === 'number') {
        date = new Date(dateVal < 10000000000 ? dateVal * 1000 : dateVal);
    } else if (typeof dateVal === 'string' && /^\d+$/.test(dateVal)) {
        const num = parseInt(dateVal, 10);
        date = new Date(num < 10000000000 ? num * 1000 : num);
    } else {
        date = new Date(dateVal);
    }
    
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
}

/**
 * Adjust outgoing messages backdated behind incoming messages due to clock drift.
 * Uses a 30-second sliding bubble-sort window.
 * @param {Array} messages List of raw messages from WAHA
 * @returns {Array} Compensated chronological message array
 */
export function compensateMessageOrdering(messages) {
    if (!Array.isArray(messages)) return [];

    // Convert timestamps to numeric milliseconds for stable comparison
    const msgs = messages.map(m => {
        let t = m.timestamp;
        if (typeof t === 'number') {
            if (t < 10000000000) t = t * 1000;
        } else {
            t = new Date(t).getTime();
        }
        return { ...m, _time: t };
    });

    // Initial chronological sort
    msgs.sort((a, b) => a._time - b._time);

    // Apply drift bubble adjustments
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < msgs.length - 1; i++) {
            const current = msgs[i];
            const next = msgs[i + 1];
            const timeDiff = next._time - current._time;
            
            // Swap if an outgoing message is sorted before an incoming message within a 30-sec window
            if (current.fromMe && !next.fromMe && timeDiff >= 0 && timeDiff <= 30000) {
                msgs[i] = next;
                msgs[i + 1] = current;
                
                // Advance the outgoing message's timestamp to be exactly 1 second after the incoming one
                current._time = next._time + 1000;
                if (typeof current.timestamp === 'number') {
                    current.timestamp = Math.floor(current._time / 1000);
                } else {
                    current.timestamp = new Date(current._time).toISOString();
                }
                
                changed = true;
            }
        }
    }

    // Clean up temporary property
    return msgs.map(({ _time, ...m }) => m);
}