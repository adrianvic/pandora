export class BaseComponent<T extends HTMLElement = HTMLElement> {
    public readonly element: T;

    constructor(elementOrTag: T | string) {
        if (typeof elementOrTag === 'string') {
            this.element = document.createElement(elementOrTag) as unknown as T;
        } else {
            this.element = elementOrTag;
        }
    }
    
    protected query<E extends HTMLElement>(selector: string): E {
        const el = this.element.querySelector<E>(selector);
        if (!el) throw new Error(`"${el}" was not found in ${this.constructor.name}.`);
        return el;
    }

    protected queryAll<E extends HTMLElement>(selector: string): NodeListOf<E> {
        return this.element.querySelectorAll<E>(selector);
    }

    public setVisibility(visible: boolean) {
        if (!visible) {
            this.element.classList.add("hidden");
        } else this.element.classList.remove("hidden");
    }

    protected bindEvent(selector: string, event: string, handler: (e: Event) => void) {
        this.query(selector).addEventListener(event, handler.bind(this));
    }

    public destroy() {
        this.element.remove();
    }
}