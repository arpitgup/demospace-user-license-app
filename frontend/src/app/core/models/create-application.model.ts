
export interface CreateApplication {
  id: number;
  name: string;
  is_active: boolean;
  license_type?: string;
  license_group?: string;
  license_count?: number;
  licenseAssignedToBots?: number;
  custom_SAML_attribute?: string;
  isSelected: boolean;
  isEnabled: boolean;
  isRemove?: boolean;
  isEditable?: boolean;
  isPaused?: boolean;
  remainingLicenseCount?: number;
}
