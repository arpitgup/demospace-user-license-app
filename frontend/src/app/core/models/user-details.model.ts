export interface UserDetails {
  is_exist: boolean;
  primary_email: string;
  secondary_email: string;
  first_name: string;
  last_name: string;
  user_name: string;
  costCenter: string;
  jobTitle: string;
  department: string;
  orgUnitPath: string;
  demoName: string;
  managerEmail: string;
  password?:string;
  employeeID?:string;

}
