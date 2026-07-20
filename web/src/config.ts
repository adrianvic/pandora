export interface Config {
    wahaUrl: string;
    session: string;
    apiKey: string;
    bgImg: string;
    bgOpacity: string;
    save(url: string, session: string, apiKey: string, bgImg: string, bgOpacity: string): void;
}

export const config: Config = {
    wahaUrl: localStorage.getItem('waha_url') || 'http://inspiran.beetal-castor.ts.net:3100',
    session: localStorage.getItem('waha_session') || 'session_01kxc62bk5fs8vh4v127k88a7j',
    apiKey: localStorage.getItem('waha_api_key') || '',
    bgImg: localStorage.getItem('background_image') || '',
    bgOpacity: localStorage.getItem('background_opacity') || '0.4',

    save(url: string, session: string, apiKey: string, bgImg: string, bgOpacity: string): void {
        this.wahaUrl = url.trim().replace(/\/$/, "");
        this.session = session.trim();
        this.apiKey = apiKey.trim();
        this.bgImg = bgImg.trim();
        this.bgOpacity = bgOpacity.trim();

        localStorage.setItem('waha_url', this.wahaUrl);
        localStorage.setItem('waha_session', this.session);
        localStorage.setItem('waha_api_key', this.apiKey);
        localStorage.setItem('background_image', this.bgImg);
        localStorage.setItem('background_opacity', this.bgOpacity);
    }
};
