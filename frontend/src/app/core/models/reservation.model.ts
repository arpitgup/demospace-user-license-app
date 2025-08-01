export interface Reservation {
  id: string;
  userId: string;
  assignedBotId: string;
  primaryApplicationId: string;
  additionalApplicationIds: string[];
  startDate: string; // ISO 8601 format string
  endDate: string; // ISO 8601 format string
  createdAt: string; // ISO 8601 format string
  provisioned: boolean;
  deprovisioned: boolean;
}
