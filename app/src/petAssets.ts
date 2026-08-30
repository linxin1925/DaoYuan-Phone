import idle from './assets/pet-v11/idle.webm?inline';
import tapReaction from './assets/pet-v11/tap.webm?inline';
import phoneEnter from './assets/pet-v11/jade-enter.webm?inline';
import phoneLoop from './assets/pet-v11/jade-loop.webm?inline';
import phoneExit from './assets/pet-v11/jade-exit.webm?inline';
import ziweiIdle01 from './assets/pet/ziwei/idle/idle_01.png?inline';
import ziweiIdle02 from './assets/pet/ziwei/idle/idle_02.png?inline';
import ziweiIdle03 from './assets/pet/ziwei/idle/idle_03.png?inline';
import ziweiTap01 from './assets/pet/ziwei/tap-reaction/tap-reaction_01.png?inline';
import ziweiTap02 from './assets/pet/ziwei/tap-reaction/tap-reaction_02.png?inline';
import ziweiEnter01 from './assets/pet/ziwei/phone-enter/phone-enter_01.png?inline';
import ziweiEnter02 from './assets/pet/ziwei/phone-enter/phone-enter_02.png?inline';
import ziweiLoop from './assets/pet/ziwei/phone-loop/phone-loop_03.png?inline';
import ziweiExit01 from './assets/pet/ziwei/phone-exit/phone-exit_01.png?inline';
import ziweiExit02 from './assets/pet/ziwei/phone-exit/phone-exit_02.png?inline';

export type PetState = 'Idle' | 'TapReaction' | 'PhoneEnter' | 'PhoneLoop' | 'PhoneExit';
export type PetKind = 'whale' | 'ziwei';

export const WHALE_PET_VIDEOS: Record<PetState, string> = {
  Idle: idle,
  TapReaction: tapReaction,
  PhoneEnter: phoneEnter,
  PhoneLoop: phoneLoop,
  PhoneExit: phoneExit,
};

export const ZIWEI_PET_SEQUENCES: Record<PetState, readonly string[]> = {
  Idle: [ziweiIdle01, ziweiIdle02, ziweiIdle03, ziweiIdle02],
  TapReaction: [ziweiTap01, ziweiTap02],
  PhoneEnter: [ziweiEnter01, ziweiEnter02],
  PhoneLoop: [ziweiLoop],
  PhoneExit: [ziweiExit01, ziweiExit02],
};

export const ZIWEI_FRAME_DURATION: Record<PetState, number> = {
  Idle: 1100,
  TapReaction: 360,
  PhoneEnter: 440,
  PhoneLoop: 1200,
  PhoneExit: 360,
};
