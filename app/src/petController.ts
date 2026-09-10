import { WHALE_PET_VIDEOS, type PetKind, type PetState } from './petAssets';

export type PetSize = 'small' | 'medium' | 'large';

const LOOPING_STATES = new Set<PetState>(['Idle', 'PhoneLoop']);

export class ZiweiPetController {
  private state: PetState = 'Idle';
  private transitionTimer: number | null = null;
  private frontIndex = 0;
  private renderGeneration = 0;
  private destroyed = false;
  private alphaCompatibilityChecked = new WeakSet<HTMLVideoElement>();

  constructor(
    private readonly root: HTMLButtonElement,
    private readonly videos: readonly [HTMLVideoElement, HTMLVideoElement],
    private readonly image: HTMLImageElement,
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

  setKind(kind: PetKind): void {
    if (this.destroyed) return;
    this.root.dataset.petKind = kind;
    for (const video of this.videos) {
      video.pause();
      video.classList.remove('is-front');
    }
    this.renderState(this.state);
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
    this.image.removeAttribute('src');
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

    this.image.removeAttribute('src');
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
      this.detectLostAlpha(next);
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
    next.src = WHALE_PET_VIDEOS[state];
    next.load();
    if (next.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) promote();

    this.root.dispatchEvent(new CustomEvent('daoyuan:pet-statechange', { detail: { state } }));
  }

  private detectLostAlpha(video: HTMLVideoElement): void {
    if (this.alphaCompatibilityChecked.has(video) || !video.videoWidth || !video.videoHeight) return;
    this.alphaCompatibilityChecked.add(video);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, 2, 2);
      const pixels = context.getImageData(0, 0, 2, 2).data;
      let opaqueBlackCorners = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 245 && pixels[index] < 12 && pixels[index + 1] < 12 && pixels[index + 2] < 12) opaqueBlackCorners += 1;
      }
      if (opaqueBlackCorners === 4) this.root.classList.add('is-alpha-fallback');
    } catch {
      // Canvas probing is optional. Normal transparent playback remains the default.
    }
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
