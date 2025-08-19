import { ServerTimeMode } from './search-by-date.enums';

export const SERVER_TIME_MODE: ServerTimeMode = 'utc';
export const TIME_SLOT_START_HOUR = 8;
export const TIME_SLOT_END_HOUR = 23;
export const END_SLOT_INCREMENT = 2;
export const MIN_DURATION = 2;
export const MAX_DURATION = 48;
export const SELF_COOLDOWN_HOURS = 1;
export const HIDE_CONFLICTING_END_SLOTS = false;