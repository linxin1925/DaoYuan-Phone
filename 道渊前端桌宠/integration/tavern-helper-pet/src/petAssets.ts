import idle01 from './assets/pet/ziwei/idle/idle_01.png?inline';
import idle02 from './assets/pet/ziwei/idle/idle_02.png?inline';
import idle03 from './assets/pet/ziwei/idle/idle_03.png?inline';
import tap01 from './assets/pet/ziwei/tap-reaction/tap-reaction_01.png?inline';
import tap02 from './assets/pet/ziwei/tap-reaction/tap-reaction_02.png?inline';
import phoneEnter01 from './assets/pet/ziwei/phone-enter/phone-enter_01.png?inline';
import phoneEnter02 from './assets/pet/ziwei/phone-enter/phone-enter_02.png?inline';
import phoneLoop from './assets/pet/ziwei/phone-loop/phone-loop_03.png?inline';
import phoneExit01 from './assets/pet/ziwei/phone-exit/phone-exit_01.png?inline';
import phoneExit02 from './assets/pet/ziwei/phone-exit/phone-exit_02.png?inline';

export type PetState = 'Idle' | 'TapReaction' | 'PhoneEnter' | 'PhoneLoop' | 'PhoneExit';

export const PET_SEQUENCES: Record<PetState, readonly string[]> = {
  Idle: [idle01, idle02, idle03, idle02],
  TapReaction: [tap01, tap02],
  PhoneEnter: [phoneEnter01, phoneEnter02],
  PhoneLoop: [phoneLoop],
  PhoneExit: [phoneExit01, phoneExit02],
};

export const PET_FRAME_DURATION: Record<PetState, number> = {
  Idle: 1100,
  TapReaction: 360,
  PhoneEnter: 440,
  PhoneLoop: 1200,
  PhoneExit: 360,
};
