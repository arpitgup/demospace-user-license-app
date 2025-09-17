export type DowntimeReason =
  | 'Maintenance'
  | 'Version Update'
  | 'Security Patch'
  | 'Planned Outage'
  | 'Other';

export type DowntimeStatus = 'Upcoming' | 'Active' | 'Completed' | 'Canceled';

export interface ApplicationOption {
  id: string;
  name: string;
}

export interface DowntimeRecord {
  id: string;
  createdBy: string;
  createdByAvatarUrl?: string;
  applications: string[];
  reason: DowntimeReason;
  status: DowntimeStatus;
  startAt: string;
  endAt: string;
}
