import { BaseComponent } from "./BaseComponent";

export class ScrollableView<T extends HTMLElement = HTMLElement> extends BaseComponent {
    private observer: IntersectionObserver | null = null;
    private activePage: HTMLElement | null = null;
    isScrollingProgrammatically = false;
    scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    
    constructor(elementOrTag: T | string) {
        super(elementOrTag);
        this.setupIntersectionObserver();
        
        this.element.addEventListener('scroll', (e) => {
            if (this.isScrollingProgrammatically) e.preventDefault();
        });
        
        this.element.querySelectorAll('.next-page-btn').forEach(nextBtn => {
            nextBtn.addEventListener('click', () => {
                this.next();
            })
        })
    }
    
    private setupIntersectionObserver() {                                                                                                                                                  
        this.observer = new IntersectionObserver((entries) => {                                                                                                                            
            entries.forEach(entry => {                                                                                                                                                     
                if (entry.isIntersecting && entry.target !== this.activePage) {                                                                                                            
                    this.activePage = entry.target as HTMLElement;                                                                                                                         
                    
                    entry.target.dispatchEvent(new CustomEvent('intoView', {                                                                                                               
                        bubbles: true,                                                                                                                                                     
                        detail: {                                                                                                                                                          
                            page: entry.target,                                                                                                                                            
                            index: this.getCurrentIndex()                                                                                                                                  
                        }                                                                                                                                                                  
                    }));                                                                                                                                                                   
                }                                                                                                                                                                          
            });                                                                                                                                                                            
        }, {                                                                                                                                                                               
            root: this.element,                                                                                                                                                          
            threshold: 0.6                                                                                               
        });                                                                                                                                                                                
        
        this.observePages();                                                                                                                                                               
    }
    
    observePages() {                                                                                                                                                                       
        if (!this.observer) return;                                                                                                                                                        
        Array.from(this.element.children).forEach(child => {                                                                                                                             
            this.observer?.observe(child);                                                                                                                                                 
        });                                                                                                                                                                                
    }
    
    get pages(): HTMLElement[] {
        return Array.from(this.element.children) as HTMLElement[];
    }
    
    getCurrentIndex(): number {
        const width = this.element.clientWidth;
        if (width === 0) return 0;
        return Math.round(this.element.scrollLeft / width);
    }
    
    getCurrentScreen(): HTMLElement | null {
        const pages = this.pages;
        return pages[this.getCurrentIndex()] || null;
    }
    
    scrollToIndex(index: number, smooth = true) {
        const pages = this.pages;
        if (index >= 0 && index < pages.length) {
            this.scrollTo(pages[index], smooth);
        }
    }
    
    next(smooth = true) {
        this.scrollToIndex(this.getCurrentIndex() + 1, smooth);
    }
    
    previows(smooth = true) {
        this.scrollToIndex(this.getCurrentIndex() - 1, smooth);
    }
    
    scrollTo(element: HTMLElement, smooth = true) {
        this.isScrollingProgrammatically = true;
        element.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto',
            inline: 'start',
            block: 'nearest'
        });
        setTimeout(() => { this.isScrollingProgrammatically = false; }, smooth ? 400 : 50);
    }
    
    getCurrentExtraPage(): number {       
        const pages = Array.from(this.queryAll('.extra-page'));
        const activeIndex = pages.findIndex(page => page.classList.contains("shown"));                     
        return activeIndex !== -1 ? activeIndex : 0;
    }
}