import { sleep } from "../utils";
import { BaseComponent } from "./BaseComponent";

export class ImagePreview extends BaseComponent {
    readonly transition: number;

    constructor(src: string, subtitle: string, transition = 600) {
        super('div');
        this.transition = transition;
        this.element.classList.add('collapsed');
        this.element.id = "image-preview";
        this.element.style.transition = `${transition}ms cubic-bezier(0.165, 0.84, 0.44, 1)`
        this.element.onclick = (event) => {
            if (event.currentTarget == this.element) this.element.classList.add('collapsed');
        }
        this.element.innerHTML = `
            <div class="image-holder">
                <img id="image-preview-img" src="${src}">
            </div>
            <label for="image-preview-img" id="image-preview-subtitle">${subtitle}</label>
        `;
    }

    public show() {
        this.element.classList.remove('collapsed');
    }
    
    public async hide() {
        this.element.classList.add('collapsed');
        await sleep(this.transition);
        return;
    }
}