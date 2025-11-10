export interface OnBoardNewDemoRequest {
  demo_id: string;
  demo_title: string;
  demo_user_group_email: string;
  gemini_enterprise_app_link: string;
  drive_folder_link: string;
  demo_onboarding_status: string;
  feature_license_app: boolean;
  saas_applications: string;
  organization_unit: string;
}
