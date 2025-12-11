import { Reservation } from './reservation.model';

export interface AdminReservation {
  data: Reservation[];
  totalRecords: number;
  pageSize: number;
  pageIndex: number;
}
