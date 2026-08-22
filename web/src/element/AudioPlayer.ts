import { BaseComponent } from "./BaseComponent";

export class AudioPlayer extends BaseComponent {
    src: string;
    player: HTMLAudioElement;
    progressBar: HTMLInputElement;
    playPauseButton: HTMLButtonElement;
    
    constructor(src: string) {
        super('div');
        
        this.element.classList.add('audio-player')
        this.src = src
        
        this.player = document.createElement('audio');
        this.player.src = src;

        this.progressBar = document.createElement('input');
        this.progressBar.max = '100';
        this.progressBar.min = '0';
        this.progressBar.value = '0';
        this.progressBar.defaultValue = '0';
        this.progressBar.type = 'range';

        this.playPauseButton = document.createElement('button');
        this.playPauseButton.classList = 'mif-play mif-3x'
        this.playPauseButton.addEventListener('click', () => {
            this.toggle();
        })

        this.player.addEventListener('timeupdate', this.updateProgress);

        this.progressBar.addEventListener('change', (e) => {
            this.pause()
            this.player.currentTime = (this.player.duration / 100) * parseFloat((e.target as HTMLInputElement).value);
            this.play()
        })

        this.element.appendChild(this.player)
        this.element.appendChild(this.playPauseButton)
        this.element.appendChild(this.progressBar)
    }

    play() {
        this.player.play();
        this.playPauseButton.classList.remove('mif-play');
        this.playPauseButton.classList.add('mif-pause');
    }
    
    pause() {
        this.player.pause();
        this.playPauseButton.classList.remove('mif-pause');
        this.playPauseButton.classList.add('mif-play');
    }

    toggle() {
        this.player.paused ? this.play() : this.pause();
    }

    private updateProgress = (): void => {
        const { duration, currentTime } = this.player;

        if (!Number.isFinite(duration) || duration <= 0) {
            return;
        }

        this.progressBar.value = ((currentTime / duration) * 100).toString();
    }
}