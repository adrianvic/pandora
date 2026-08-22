import { config } from "../config";
import { BaseComponent } from "./BaseComponent";

export class SettingsPage extends BaseComponent {
    private inputWahaUrl: HTMLInputElement;
    private inputSession: HTMLInputElement;
    private inputApiKey: HTMLInputElement;
    private inputBackgroundImage: HTMLInputElement;
    private inputBackgroundOpacity: HTMLInputElement;
    private saveBtn: HTMLButtonElement;
    private purgeBtn: HTMLButtonElement;
    private themeFieldset: HTMLFieldSetElement;

    constructor(el: HTMLElement) {
        super(el);
        this.inputWahaUrl = this.query('#settings-waha-url');
        this.inputSession = this.query('#settings-session');
        this.inputApiKey = this.query('#settings-api-key');
        this.inputBackgroundImage = this.query('#settings-background-image');
        this.inputBackgroundOpacity = this.query('#settings-background-opacity');
        this.saveBtn = this.query('#save-settings');
        this.purgeBtn = this.query('#purge-database');
        this.themeFieldset = this.query('#settings-theme');

        this.initValues();
        this.bindEvents();
    }

    private initValues() {
        this.inputWahaUrl.value = config.wahaUrl;
        this.inputSession.value = config.session;
        this.inputApiKey.value = config.apiKey;
        this.inputBackgroundImage.value = config.bgImg;
        this.inputBackgroundOpacity.value = config.bgOpacity;

        const loadedTheme = localStorage.getItem('pandora_theme') ?? '';
        const radio = this.themeFieldset.querySelector(`input[value="${loadedTheme}"]`) as HTMLInputElement;
        if (radio) radio.checked = true;
    }

    private bindEvents() {
        this.saveBtn.addEventListener('click', () => {
            config.save(
                this.inputWahaUrl.value,
                this.inputSession.value,
                this.inputApiKey.value,
                this.inputBackgroundImage.value,
                this.inputBackgroundOpacity.value
            );
            location.reload();
        });

        this.purgeBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to delete all cached messages?") && confirm("This cannot be undone. Proceed?")) {
                localStorage.clear();
                this.element.dispatchEvent(new CustomEvent('purge-database'));
                location.reload();
            }
        });

        this.themeFieldset.addEventListener('change', () => {
            const selected = this.themeFieldset.querySelector('input[name="plan"]:checked') as HTMLInputElement;
            const value = selected?.value ?? '';
            localStorage.setItem("pandora_theme", value);
            this.element.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: value } }));
        });
    }
}
