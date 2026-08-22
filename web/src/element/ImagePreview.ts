import { sleep } from "../utils";
import { BaseComponent } from "./BaseComponent";

export class ImagePreview extends BaseComponent {
    readonly transition: number;
    private scale = 1;
    private translateX = 0;
    private translateY = 0;
    private lastPinchDistance = 0;
    private isDragging = false;
    private lastX = 0;
    private lastY = 0;
    private imgElement: HTMLImageElement | null = null;

    constructor(src: string, subtitle: string, transition = 600) {
        super('div');
        this.transition = transition;
        this.element.classList.add('collapsed');
        this.element.id = "image-preview";
        this.element.style.transition = `${transition}ms cubic-bezier(0.165, 0.84, 0.44, 1)`

        this.element.innerHTML = `
            <div class="image-holder">
                <img id="image-preview-img" src="${src}" draggable="false">
            </div>
        `;

        if (subtitle && subtitle != '') this.element.innerHTML += `<label for="image-preview-img" id="image-preview-subtitle">${subtitle}</label>`;

        this.imgElement = this.element.querySelector('#image-preview-img');

        this.element.onclick = async (event) => {
            if (event.target === this.element || (event.target as HTMLElement).classList.contains('image-holder')) {
                await this.hide();
                this.destroy();
            }
        };

        this.setupEvents();
    }

    private setupEvents() {
        // Desktop zoom: Ctrl + Scroll
        this.element.onwheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = -e.deltaY;
                const zoomSpeed = 0.001;
                this.updateZoom(this.scale + delta * zoomSpeed);
            }
        };

        // Touch events for mobile
        this.element.ontouchstart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                this.lastPinchDistance = this.getDistance(e.touches[0], e.touches[1]);
            } else if (e.touches.length === 1) {
                this.isDragging = true;
                this.lastX = e.touches[0].clientX;
                this.lastY = e.touches[0].clientY;
            }
        };

        this.element.ontouchmove = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
                if (this.lastPinchDistance > 0) {
                    const zoomFactor = currentDistance / this.lastPinchDistance;
                    this.updateZoom(this.scale * zoomFactor);
                }
                this.lastPinchDistance = currentDistance;
            } else if (e.touches.length === 1 && this.isDragging && this.scale > 1) {
                e.preventDefault();
                const deltaX = e.touches[0].clientX - this.lastX;
                const deltaY = e.touches[0].clientY - this.lastY;
                this.translateX += deltaX;
                this.translateY += deltaY;
                this.clampTransform();
                this.lastX = e.touches[0].clientX;
                this.lastY = e.touches[0].clientY;
                this.updateTransform();
            }
        };

        this.element.ontouchend = () => {
            this.isDragging = false;
            this.lastPinchDistance = 0;
        };

        // Mouse dragging for PC
        this.element.onmousedown = (e: MouseEvent) => {
            if (this.scale > 1) {
                this.isDragging = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
            }
        };

        window.addEventListener('mousemove', this.handleMouseMove);
        window.addEventListener('mouseup', this.handleMouseUp);
    }

    private handleMouseMove = (e: MouseEvent) => {
        if (this.isDragging) {
            const deltaX = e.clientX - this.lastX;
            const deltaY = e.clientY - this.lastY;
            this.translateX += deltaX;
            this.translateY += deltaY;
            this.clampTransform();
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.updateTransform();
        }
    };

    private handleMouseUp = () => {
        this.isDragging = false;
    };

    private getDistance(t1: Touch, t2: Touch): number {
        return Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
    }

    private updateZoom(newScale: number) {
        this.scale = Math.min(Math.max(1, newScale), 5); // Limit zoom between 1x and 5x

        if (this.scale === 1) {
            // Reset translation when at 1x scale to ensure it's centered
            this.translateX = 0;
            this.translateY = 0;
        } else {
            // Keep the translation but clamp it to ensure it stays in view
            this.clampTransform();
        }

        this.updateTransform();
    }

    private clampTransform() {
        if (!this.imgElement) return;

        // Calculate boundaries. The image is centered by default.
        // We allow panning such that the edges don't go too far past the center.
        const viewportWidth = this.element.clientWidth;
        const viewportHeight = this.element.clientHeight;

        // At scale > 1, the image's effective size is dimensions * scale.
        // We want to limit translate so at least some part of the image stays visible.
        const maxW = (viewportWidth * this.scale) / 2;
        const maxH = (viewportHeight * this.scale) / 2;

        this.translateX = Math.min(Math.max(this.translateX, -maxW), maxW);
        this.translateY = Math.min(Math.max(this.translateY, -maxH), maxH);
    }

    private updateTransform() {
        if (this.imgElement) {
            this.imgElement.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
        }
    }

    public show() {
        void this.element.offsetWidth; // Force reflow
        this.element.classList.remove('collapsed');
    }
    
    public async hide() {
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('mouseup', this.handleMouseUp);
        this.element.classList.add('collapsed');
        await sleep(this.transition);
        return;
    }
}
