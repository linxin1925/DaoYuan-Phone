const STATES = Object.freeze({
  IDLE: 'Idle',
  TAP_REACTION: 'TapReaction',
  PHONE_ENTER: 'PhoneEnter',
  PHONE_LOOP: 'PhoneLoop',
  PHONE_EXIT: 'PhoneExit',
});

const TRANSITIONS = Object.freeze({
  [STATES.IDLE]: [STATES.TAP_REACTION],
  [STATES.TAP_REACTION]: [STATES.PHONE_ENTER, STATES.IDLE],
  [STATES.PHONE_ENTER]: [STATES.PHONE_LOOP, STATES.PHONE_EXIT],
  [STATES.PHONE_LOOP]: [STATES.PHONE_EXIT],
  [STATES.PHONE_EXIT]: [STATES.IDLE],
});

const PHONE_STATES = new Set([STATES.PHONE_ENTER, STATES.PHONE_LOOP]);

/**
 * PNG 序列帧适配器。
 * 资源只通过 manifest 注入，状态机不依赖具体图片文件名或渲染库。
 */
export class PngSequenceAdapter {
  constructor({ mount, manifestUrl = '/assets/pet/ziwei/manifest.json' } = {}) {
    this.mount = mount;
    this.manifestUrl = manifestUrl;
    this.manifest = {};
    this.currentMotion = STATES.IDLE;
    this.frameIndex = 0;
    this.timer = null;
    this.image = mount?.querySelector('[data-pet-image]');
    this.placeholder = mount?.querySelector('[data-pet-placeholder]');
  }

  async load() {
    try {
      const response = await fetch(this.manifestUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`PNG manifest ${response.status}`);
      this.manifest = await response.json();
    } catch {
      this.manifest = {};
    }
    this.setMotion(this.currentMotion);
    return this;
  }

  setMotion(state) {
    this.currentMotion = state;
    clearInterval(this.timer);
    this.frameIndex = 0;
    const sequence = this.manifest[state] ?? [];
    this.mount?.setAttribute('data-png-motion', state);
    if (!sequence.length) {
      this.showPlaceholder();
      return;
    }

    this.showFrame(sequence[0]);
    if (sequence.length > 1) {
      this.timer = setInterval(() => {
        this.frameIndex = (this.frameIndex + 1) % sequence.length;
        this.showFrame(sequence[this.frameIndex]);
      }, this.manifest.frameDurationByState?.[state] ?? this.manifest.frameDurationMs ?? 260);
    }
  }

  showFrame(src) {
    if (!this.image) return;
    this.image.onload = () => {
      this.image.hidden = false;
      if (this.placeholder) this.placeholder.hidden = true;
    };
    this.image.onerror = () => this.showPlaceholder();
    this.image.src = src;
    this.image.alt = `紫薇 ${this.currentMotion} 序列帧 ${this.frameIndex + 1}`;
  }

  showPlaceholder() {
    if (this.image) this.image.hidden = true;
    if (this.placeholder) this.placeholder.hidden = false;
  }
}

export class PetStateMachine extends EventTarget {
  constructor({ adapter, onStateChange } = {}) {
    super();
    this.state = STATES.IDLE;
    this.adapter = adapter;
    this.onStateChange = onStateChange;
    this.timer = null;
  }

  transition(nextState) {
    if (!TRANSITIONS[this.state]?.includes(nextState)) return false;
    clearTimeout(this.timer);
    const previous = this.state;
    this.state = nextState;
    this.adapter?.setMotion(nextState);
    this.onStateChange?.(nextState, previous);
    this.dispatchEvent(new CustomEvent('statechange', { detail: { nextState, previous } }));

    if (nextState === STATES.TAP_REACTION) this.timer = setTimeout(() => this.transition(STATES.PHONE_ENTER), 660);
    if (nextState === STATES.PHONE_ENTER) this.timer = setTimeout(() => this.transition(STATES.PHONE_LOOP), 880);
    if (nextState === STATES.PHONE_EXIT) this.timer = setTimeout(() => this.transition(STATES.IDLE), 660);
    return true;
  }

  openPhone() { return this.state === STATES.IDLE && this.transition(STATES.TAP_REACTION); }
  closePhone() { return PHONE_STATES.has(this.state) && this.transition(STATES.PHONE_EXIT); }
}

const root = document.querySelector('.desktop-pet');
const petButton = document.querySelector('#pet-button');
const jadeSlip = document.querySelector('#jade-slip');
const closeJade = document.querySelector('#close-jade');
const stateLabel = document.querySelector('#state-label');
const adapter = new PngSequenceAdapter({ mount: root });
const machine = new PetStateMachine({
  adapter,
  onStateChange: (state) => {
    root.dataset.petState = state;
    stateLabel.textContent = state;
    const phoneOpen = PHONE_STATES.has(state);
    jadeSlip.setAttribute('aria-hidden', String(!phoneOpen));
    jadeSlip.classList.toggle('is-open', phoneOpen);
    window.dispatchEvent(new CustomEvent('pet:statechange', { detail: { state } }));
    if (state === STATES.PHONE_ENTER) window.dispatchEvent(new CustomEvent('pet:jade-open'));
    if (state === STATES.PHONE_EXIT) window.dispatchEvent(new CustomEvent('pet:jade-close'));
    if (state === STATES.PHONE_LOOP) closeJade.focus();
  },
});

petButton.addEventListener('click', () => machine.openPhone());
closeJade.addEventListener('click', () => machine.closePhone());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') machine.closePhone();
});

const pet = Object.freeze({
  openJadeUI: () => machine.openPhone(),
  closeJadeUI: () => machine.closePhone(),
  getState: () => machine.state,
  on: (eventName, listener, options) => window.addEventListener(`pet:${eventName}`, listener, options),
  off: (eventName, listener, options) => window.removeEventListener(`pet:${eventName}`, listener, options),
});

window.pet = pet;
adapter.load();

export { STATES, TRANSITIONS, machine, pet };
