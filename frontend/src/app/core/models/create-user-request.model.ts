export interface CreateUserRequest {
  primary_email: string;
  secondary_email: string;
  first_name: string;
  last_name: string;
  costCenter: string;
  jobTitle: string;
  department: string;
  orgUnitPath: '/';
  demoName: string;
  managerEmail: string;
}

