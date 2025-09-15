export interface AppConfig {
  maxReservationApplications: number;
  maxCalendarDays: number;
  rollingWindowHours: number;
  reservationLeadDays: number;
  unavailableReservationDays: number;
  maxSlotsToFind: number;
  reservationCoolOffHours:number;
  minLeadCooldownHours:number;
}