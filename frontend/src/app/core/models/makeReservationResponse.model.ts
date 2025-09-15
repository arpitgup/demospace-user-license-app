import { Application } from './application.model';

export interface MakeReservationResponse {
  id?: number;
  userEmail?: string;
  bot?: Bot;
  applications?: Application[];
  startTime?: string;
  endTime?: string;
}

export interface Bot {
  id?: number;
  name?: string;
  email?: string;
}
