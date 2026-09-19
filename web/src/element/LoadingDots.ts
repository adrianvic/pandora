import { BaseComponent } from "./BaseComponent";

export class LoadingDots<T extends HTMLElement = HTMLElement> extends BaseComponent {
    constructor(elementOrTag: T | string) {
        super(elementOrTag);
        
        this.element.classList.add('loading-animation-wrapper');
        this.element.style.display = 'block';
        this.element.style.visibility = 'visible';
        this.element.style.opacity = '1';
        this.element.style.zIndex = '100';

        this.element.innerHTML = `
            <div class="animation" style="display: block !important; visibility: visible !important;">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
    }
}