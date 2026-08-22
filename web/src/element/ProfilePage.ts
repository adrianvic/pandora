import { sendStatus } from "../storage";
import { showNotification } from "../notification";
import { debounce } from "../utils";
import { BaseComponent } from "./BaseComponent";

export class ProfilePage extends BaseComponent {
    private inputStatus: HTMLInputElement;

    constructor(el: HTMLElement) {
        super(el);
        this.inputStatus = this.query('#profile-page-status-input');
        this.bindEvents();
    }

    private bindEvents() {
        this.inputStatus.addEventListener('input', debounce(async () => {
            const result = await sendStatus(this.inputStatus.value);
            if (result?.success) {
                showNotification("Status updated successfully!", "", 2000);
            } else {
                showNotification("Failed to update status...", "", 2000);
            }
        }, 2000));
    }
}
