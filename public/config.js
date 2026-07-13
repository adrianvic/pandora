// Client Configuration State & Storage Manager

export const config = {
    wahaUrl: localStorage.getItem('waha_url') || 'http://inspiran.beetal-castor.ts.net:3100',
    session: localStorage.getItem('waha_session') || 'session_01kxc62bk5fs8vh4v127k88a7j',
    apiKey: localStorage.getItem('waha_api_key') || '',

    save(url, session, apiKey) {
        this.wahaUrl = url.trim().replace(/\/$/, "");
        this.session = session.trim();
        this.apiKey = apiKey.trim();

        localStorage.setItem('waha_url', this.wahaUrl);
        localStorage.setItem('waha_session', this.session);
        localStorage.setItem('waha_api_key', this.apiKey);
    }
};
