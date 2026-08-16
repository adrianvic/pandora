import { config } from "./config";
import { elements, ScrollableView, ui, views } from "./ui";
import { waha } from "./waha";

const page = views.get(elements.appContainer);
page?.scrollToIndex(0);
const statusConnection = document.getElementById("connecting-status");
const connectingPage = document.getElementById("connecting-page");
const loading = document.getElementById("connecting-animation");
const connectingNextBtn = document.getElementById("connecting-next-btn");
const settingsApiKey = document.getElementById("settings-api-key") as HTMLInputElement;
const settingsSession = document.getElementById("settings-session") as HTMLInputElement;
const settingsWahaURL = document.getElementById("settings-waha-url") as HTMLInputElement;

if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

window.addEventListener('load', () => {
    window.scrollTo(0, 0);
    if (localStorage.getItem('setupComplete') == 'true') {
        window.location.href = 'app.html';
    }
});

if (connectingPage) {
    connectingPage.addEventListener('intoView', () => {
        testConnection();
    })
}

connectingNextBtn?.addEventListener('click', () => {
    localStorage.setItem('setupComplete', 'true');
    window.location.href = "app.html";
})

async function testConnection() {
    console.log(settingsWahaURL?.value)
    config.save(settingsWahaURL?.value, settingsSession?.value, settingsApiKey?.value, "", "");
    if (!statusConnection || !connectingNextBtn || !loading) return;
    statusConnection.textContent = "Asking for server version...";
    
    try {
        const resp = await waha.getMyInfo();
        
        if (resp.pushName != null) {
            statusConnection.textContent = `Logged in as ${resp.pushName}`
            connectingNextBtn.style.display = 'flex';
            loading.style.display = 'none';
        } else {
            page?.previows();
        }
    } catch (e) {
        console.log(e);
        page?.previows();
    }
}