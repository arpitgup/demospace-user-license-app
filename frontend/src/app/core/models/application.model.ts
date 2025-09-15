/**
 * Represents a single SaaS application available for reservation.
 * Based on the GET /applications endpoint.
 */
export interface Application {
  id: number;
  name: string;
  isActive:boolean;
  isSelected: boolean;
  isEnabled: boolean;
}
