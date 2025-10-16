import { Application } from './application.model';

export interface AvalaibilityByApplication {
  requestedSlotAvailable?: boolean;
  isDowntimeConflict?:boolean;
  nextAvailableSlots?: NextAvailableSlots[];
}

export interface NextAvailableSlots {
  startTime?: string;
  endTime?: string;
  availableBots?: AvailableBots[];
  isSelected?: boolean;
  isLessDurationSlots?:boolean;
  isSameDay?:boolean;
}

export interface AvailableBots {
  id?: string;
  name?: string;
  email?: string;
  applications?: Application[];
}
