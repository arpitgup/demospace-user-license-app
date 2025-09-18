export interface UpdateApplicationRequest {
  applications: ApplicationDetails[];
}

interface ApplicationDetails {
  id: number;
  name: string;
  isActive: boolean;
  licenseType?: string;
  licenseGroup?: string;
}
