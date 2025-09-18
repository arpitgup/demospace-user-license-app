export interface CreateApplicationRequest {
  name: string;
  is_active: boolean;
  license_type: string;
  license_group: string;
  license_count: number;
}
