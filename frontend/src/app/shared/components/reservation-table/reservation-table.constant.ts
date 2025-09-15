export const RESERVATION_TABLE_CONSTANTS = {
  NO_RESERVATIONS_MSG: 'No reservations to display.',
  DATE_HEADER: 'Reservation Date',
  APPLICATIONS_HEADER: 'Applications',
  STATUS_HEADER: 'Status',
  ACTION_HEADER: 'Action',
  VIEW_BUTTON: 'View',
  CANCEL_BUTTON: 'Cancel',
  PAGINATOR_ARIA_LABEL: 'Select page of reservations',
};


export enum ReservationStatus {
  PAST = 'Past',
  CURRENT = 'Current',
  UPCOMING = 'Upcoming',
}
