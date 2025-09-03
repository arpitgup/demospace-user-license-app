import { Component } from '@angular/core';
import { ADMIN_RESERVATION_CONSTANTS } from './admin-reservation.constant';
import { MatTabChangeEvent, MatTabsModule } from '@angular/material/tabs';
import { ReservationApiStatus } from '../../landing/landing.enums';
import { AdminReservationTableComponent } from '../admin-reservation-table/admin-reservation-table.component';


@Component({
  selector: 'app-admin-reservation',
  imports: [MatTabsModule,AdminReservationTableComponent],
  templateUrl: './admin-reservation.html',
  styleUrl: './admin-reservation.scss',
})
export class AdminReservation {
  readonly adminReservationConstants = ADMIN_RESERVATION_CONSTANTS;
  readonly reservationApiStatus = ReservationApiStatus;
  selectedIndex = 0;

  onTabChange(event: MatTabChangeEvent): void {
    this.selectedIndex = event.index;
  }
}
