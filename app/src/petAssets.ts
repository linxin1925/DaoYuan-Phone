import idle from './assets/pet-v11/idle.webm?inline';
import tapReaction from './assets/pet-v11/tap.webm?inline';
import phoneEnter from './assets/pet-v11/jade-enter.webm?inline';
import phoneLoop from './assets/pet-v11/jade-loop.webm?inline';
import phoneExit from './assets/pet-v11/jade-exit.webm?inline';

export type PetState = 'Idle' | 'TapReaction' | 'PhoneEnter' | 'PhoneLoop' | 'PhoneExit';

export const PET_VIDEOS: Record<PetState, string> = {
  Idle: idle,
  TapReaction: tapReaction,
  PhoneEnter: phoneEnter,
  PhoneLoop: phoneLoop,
  PhoneExit: phoneExit,
};
