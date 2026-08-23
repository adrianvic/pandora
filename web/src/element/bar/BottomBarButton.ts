import { BaseComponent } from "../BaseComponent";

export class BottomBarButton extends BaseComponent {
    constructor(id: string, icon: string, onClick: () => void) {
        super('button');
        this.element.dataset.bottomBarId = id;
        this.element.classList.add('bottom-bar-button');
        this.element.classList.add('mif-2x');
        this.element.classList.add('mif-' + icon);
        this.element.addEventListener('click', () => onClick());
    }
}