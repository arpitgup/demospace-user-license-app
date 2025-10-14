export interface AdminCreateReservationRequest {
  primaryApplicationId: number;
  secondaryApplicationIds: number[];
  startTime: string;
  endTime: string;
  candidateUserEmail: string;
}
