import { Application } from './application.model';

export interface DemoDetails {
  demo_id: string;
  demo_title: string;
  demo_user_group_email: string;
  gemini_enterprise_app_link: string;
  drive_folder_link: string;
  feedback_bug_link: string;
  demo_onboarding_status: string;
  feature_license_app: string;
  saas_applications: string;
  applications: Application[];
  applicationIds:number[];
  isEdit: boolean;
  representative_profile: RepresentativeProfile;
}

interface RepresentativeProfile {
  cost_centre: string;
  manager_name: string;
  manager_email: string;
  manager_title: string;
  rep_role: string;
  rep_department: string;
  org_unit: string;
}
