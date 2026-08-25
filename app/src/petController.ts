import { PET_VIDEOS, type PetState } from './petAssets';

export type PetSize = 'small' | 'medium' | 'large';

const LOOPING_STATES = new Set<PetState>(['Idle', 'PhoneLoop']);

export class ZiweiPetController {
  private state: PetState = 'Idle';
  private transitionTimer: number | null = null;
  private frontIndex = 0;
  private renderGeneration = 0;
  private destroyed = false;

  constructor(
    private readonly root: HTMLButtonElement,
    private readonly videos: readonly [HTMLVideoElement, HTMLVideoElement],
    private readonly onPhoneReady: () => void,
  ) {
    for (const video of this.videos) {
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
    }
    this.renderState('Idle');
  }

  getState(): PetState { return this.state; }

  setSize(size: PetSize): void {
    this.root.dataset.petSize = size;
  }

  openJadeUI(): void { this.openPhone(); }

  closeJadeUI(): void { this.closePhone(); }

  openPhone(): void {
    if (this.destroyed || (this.state !== 'Idle' && this.state !== 'PhoneExit')) return;
    this.clearTransitionTimer();
    this.renderState('TapReaction');
    this.schedule(() => {
      this.renderState('PhoneEnter');
      this.onPhoneReady();
    }, 650);
  }

  closePhone(): void {
    if (this.destroyed || this.state === 'Idle' || this.state === 'PhoneExit') return;
    this.clearTransitionTimer();
    this.renderState('PhoneExit');
  }

  destroy(): void {
    this.destroyed = true;
    this.renderGeneration += 1;
    this.clearTransitionTimer();
    for (const video of this.videos) {
      video.pause();
      video.onloadeddata = null;
      video.onended = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
    }
  }

  private renderState(state: PetState): void {
    if (this.destroyed) return;
    const generation = ++this.renderGeneration;
    this.state = state;
    this.root.dataset.petState = state;
    this.root.classList.remove('is-pet-fallback');
    this.root.setAttribute('aria-expanded', String(state === 'PhoneEnter' || state === 'PhoneLoop'));

    const nextIndex = this.frontIndex === 0 ? 1 : 0;
    const current = this.videos[this.frontIndex];
    const next = this.videos[nextIndex];
    next.pause();
    next.classList.remove('is-front');
    next.loop = LOOPING_STATES.has(state);

    const promote = (): void => {
      if (this.destroyed || generation !== this.renderGeneration) return;
      next.onloadeddata = null;
      next.currentTime = 0;
      next.classList.add('is-front');
      current.classList.remove('is-front');
      current.pause();
      this.frontIndex = nextIndex;
      void next.play().catch(() => this.root.classList.add('is-pet-fallback'));
    };

    next.onloadeddata = promote;
    next.onended = () => {
      if (generation !== this.renderGeneration) return;
      if (state === 'PhoneEnter') this.renderState('PhoneLoop');
      if (state === 'PhoneExit') this.renderState('Idle');
    };
    next.onerror = () => {
      if (generation !== this.renderGeneration) return;
      this.root.classList.add('is-pet-fallback');
      if (state !== 'Idle') this.renderState('Idle');
    };
    next.src = PET_VIDEOS[state];
    next.load();
    if (next.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) promote();

    this.root.dispatchEvent(new CustomEvent('daoyuan:pet-statechange', { detail: { state } }));
  }

  private schedule(callback: () => void, delay: number): void {
    this.transitionTimer = window.setTimeout(() => {
      this.transitionTimer = null;
      callback();
    }, delay);
  }

  private clearTransitionTimer(): void {
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    this.transitionTimer = null;
  }
}
