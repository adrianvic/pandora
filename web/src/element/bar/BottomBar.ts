import { sleep } from "../../utils";
import { BaseComponent } from "../BaseComponent";
import { BottomBarButton } from "./BottomBarButton";

export abstract class BottomBar extends BaseComponent {
    readonly buttons: BottomBarButton[];

    constructor(buttons: BottomBarButton[]) {
        super('div');

        this.element.classList.add('alternate-panel');
        this.element.classList.add('collapsed');
        buttons.forEach(btn => this.element.appendChild(btn.element));
        this.buttons = buttons;
    }

    show() {
        void this.element.offsetHeight;
        this.element.classList.remove('collapsed');
    }

    override async destroy(): Promise<void> {
        this.element.classList.add('collapsed');
        await sleep(400);
        this.element.dispatchEvent(new CustomEvent('dispose'));
        super.destroy();
    }
}