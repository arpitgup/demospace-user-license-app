/**
 * Represents a single SaaS application available for reservation.
 * Based on the GET /applications endpoint.
 */
export interface Application {
  applicationId: string;
  name: string;
}
