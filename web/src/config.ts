export interface Config {
    wahaUrl: string;
    session: string;
    apiKey: string;
    bgImg: string;
    bgOpacity: string;
    theme: string;
    markRead: string;
}

export let config: Config = {
    wahaUrl: localStorage.getItem('waha_url') || '',
    session: localStorage.getItem('waha_session') || '',
    apiKey: localStorage.getItem('waha_api_key') || '',
    bgImg: localStorage.getItem('background_image') || '',
    bgOpacity: localStorage.getItem('background_opacity') || '0.4',
    theme: localStorage.getItem('pandora_theme') || '',
    markRead: localStorage.getItem('pandora_markread') || 'true',
    
};

export function saveConfig(updates: Partial<Config>): void {
    config = {
        ...config,
        ...updates,
        wahaUrl: updates.wahaUrl?.trim().replace(/\/$/, '') ?? config.wahaUrl,
        session: updates.session?.trim() ?? config.session,
        apiKey: updates.apiKey?.trim() ?? config.apiKey,
        bgImg: updates.bgImg?.trim() ?? config.bgImg,
        bgOpacity: updates.bgOpacity?.trim() ?? config.bgOpacity,
        theme: updates.theme?.trim() ?? config.theme,
        markRead: updates.markRead?.trim() ?? config.markRead,
    };

    localStorage.setItem('waha_url', config.wahaUrl);
    localStorage.setItem('waha_session', config.session);
    localStorage.setItem('waha_api_key', config.apiKey);
    localStorage.setItem('background_image', config.bgImg);
    localStorage.setItem('background_opacity', config.bgOpacity);
    localStorage.setItem('pandora_theme', config.theme);
    localStorage.setItem('pandora_markread', config.markRead);
}