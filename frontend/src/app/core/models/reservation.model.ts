import { Application } from "./application.model";

export interface Bot {
  id: number;
  name: string;
  email: string;
}


export interface Reservation {
  id: number;
  userEmail: string;
  bot: Bot;
  applications: Application[];
  startTime: string;
  endTime: string;
  status: string;
}
export interface NewReservation {
  primaryApplicationId: number;
  secondaryApplicationIds: number[];
  startTime: string;
  endTime: string;
}

export type BotWithApps = {
  id: number;
  name: string;
  email: string;
  applications: Application[];
};
