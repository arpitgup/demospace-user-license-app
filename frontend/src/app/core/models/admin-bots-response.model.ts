import { Application } from './application.model';

export interface AdminBotsResponse {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  applications: Application[];
  isEditable?: boolean;
  applicationIds: number[];
  isAdminReserved: boolean;
}
