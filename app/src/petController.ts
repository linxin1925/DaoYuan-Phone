import { PET_FRAME_DURATION, PET_SEQUENCES, type PetState } from './petAssets';

export type PetSize = 'small' | 'medium' | 'large';

export class ZiweiPetController {
  private state: PetState = 'Idle';
  private frameTimer: number | null = null;
  private transitionTimer: number | null = null;
  private frameIndex = 0;

  constructor(
    private readonly root: HTMLButtonElement,
    private readonly image: HTMLImageElement,
    private readonly onPhoneReady: () => void,
  ) {
    this.renderState('Idle');
  }

  getState(): PetState { return this.state; }

  setSize(size: PetSize): void {
    this.root.dataset.petSize = size;
  }

  openPhone(): void {
    if (this.state !== 'Idle') return;
    this.renderState('TapReaction');
    this.schedule(() => {
      this.renderState('PhoneEnter');
      this.onPhoneReady();
      this.schedule(() => this.renderState('PhoneLoop'), 880);
    }, 720);
  }

  closePhone(): void {
    if (this.state === 'Idle' || this.state === 'PhoneExit') return;
    this.renderState('PhoneExit');
    this.schedule(() => this.renderState('Idle'), 720);
  }

  destroy(): void {
    this.clearTimers();
  }

  private renderState(state: PetState): void {
    this.clearFrameTimer();
    this.state = state;
    this.frameIndex = 0;
    this.root.dataset.petState = state;
    this.root.setAttribute('aria-expanded', String(state === 'PhoneEnter' || state === 'PhoneLoop'));
    const frames = PET_SEQUENCES[state];
    this.image.src = frames[0];
    if (frames.length > 1) {
      this.frameTimer = window.setInterval(() => {
        this.frameIndex = (this.frameIndex + 1) % frames.length;
        this.image.src = frames[this.frameIndex];
      }, PET_FRAME_DURATION[state]);
    }
    this.root.dispatchEvent(new CustomEvent('daoyuan:pet-statechange', { detail: { state } }));
  }

  private schedule(callback: () => void, delay: number): void {
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    this.transitionTimer = window.setTimeout(callback, delay);
  }

  private clearFrameTimer(): void {
    if (this.frameTimer !== null) window.clearInterval(this.frameTimer);
    this.frameTimer = null;
  }

  private clearTimers(): void {
    this.clearFrameTimer();
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    this.transitionTimer = null;
  }
}
