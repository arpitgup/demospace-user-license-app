import { ArtifactsLinks } from "./artifacts_link.model";

export interface UpdateDemoDetails {
  demo_id: string;
  demo_title: string;
  demo_user_group_email: string;
  gemini_enterprise_app_link: string;
  drive_folder_link: string;
  feedback_bug_link: string;
  demo_onboarding_status: string;
  feature_license_app: boolean;
  saas_applications: string;
  applicationIds: number[];
  organization_unit: string;
  cost_centre: string;
  manager_name: string;
  manager_email: string;
  manager_title: string;
  rep_role: string;
  rep_department: string;
  org_unit: string;
  parent_bug_id:string;
  demo_summary:string;
  artifact_links:ArtifactsLinks[]
}
