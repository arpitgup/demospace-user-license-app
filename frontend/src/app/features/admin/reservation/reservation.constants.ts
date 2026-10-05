import {
  VALIDATION_DEV_EMAIL_DOMAIN,
  VALIDATION_EMAIL_DOMAIN,
} from '../../../shared/constants/domain.constants';

export const ReservationConstants = {
  ENTER_USER_DETAILS: 'Enter user Details',
  USER_EMAIL_ID: 'User Email Id',
  EMAIL_NOT_VALID: `Email not valid. ${VALIDATION_EMAIL_DOMAIN} or ${VALIDATION_DEV_EMAIL_DOMAIN} email required`,
  SELECT_DATE_RANGE: 'Select Date Range',
  START_DATE: 'Start Date',
  START_TIME: 'START_TIME',
  END_DATE: 'End Date',
  END_TIME: 'End Time',
  SELECT_THE_APPLICATIONS: 'Select the Applications',
  LICENSE_WILL_BE_START_FROM: ' License will be available from',
  LICENSE_ACCESS_WILL_END_ON: ' License access will end on',
  SELECTED_APPLICATION: 'Selected Application :',
  CONFIRM_RESERVATION: 'Confirm Reservation',
  RESERVATION_TABLE_TAB_LABEL: 'Reservation Details',
  BOOK_RESERVATION_TAB_LABEL: 'Book Reservation',
  SHOW_PAST_CHECKBOX_LABEL: 'Show Past Reservations',
  DELETE_SELECTED_RESERVATIONS: 'Delete Selected Reservations',
};
