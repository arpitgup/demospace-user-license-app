export interface AvailabilityByApplicationRequest {
  applicationId: number;
  startTime: string;
  durationHours: number;
  getNextSlots: boolean;
}
