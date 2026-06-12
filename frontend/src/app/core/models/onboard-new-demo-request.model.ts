import { ArtifactsLinks } from "./artifacts_link.model";

export interface OnBoardNewDemoRequest {
  demo_id: string;
  demo_title: string;
  demo_user_group_email: string;
  demo_onboarding_status: string;
  feature_license_app: boolean;
  saas_applications: string;
  organization_unit: string;
  cost_centre: string;
  manager_name: string;
  manager_email: string;
  manager_title: string;
  rep_role: string;
  rep_department: string;
  parent_bug_id:string;
  artifact_links:ArtifactsLinks[]
  demo_summary?: string;
}
