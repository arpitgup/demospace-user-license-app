import { Application } from './application.model';
import { ArtifactsLinks } from './artifacts_link.model';

export interface DemoDetails {
  demo_id: string;
  demo_title: string;
  demo_user_group_email: string;
  demo_onboarding_status: string;
  feature_license_app: boolean;
  saas_applications: string;
  applications: Application[];
  applicationIds: number[];
  organization_unit: string;
  isEdit: boolean;
  parent_bug_id: string;
  representative_profile: RepresentativeProfile;
  artifact_links: ArtifactsLinks[];
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
