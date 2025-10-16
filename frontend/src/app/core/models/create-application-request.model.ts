export interface CreateApplicationRequest {
  name: string;
  is_active: boolean;
  license_type: string;
  custom_SAML_attribute?: string;
  license_group: string;
  license_count: number;
}
