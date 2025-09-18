/**
 * Represents a single SaaS application available for reservation.
 * Based on the GET /applications endpoint.
 */
export interface Application {
  id: number;
  name: string;
  isActive: boolean;
  licenseType?: string;
  licenseGroup?: string;
  licenseCount?: number;
  licenseAssignedToBots?: number;
  isSelected: boolean;
  isEnabled: boolean;
  isRemove?: boolean;
  isEditable?: boolean;
  isPaused?: boolean;
  remainingLicenseCount?: number;
}
