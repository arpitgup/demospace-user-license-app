import { Component, ViewChild } from '@angular/core';
import { ADMIN_RESERVATION_CONSTANTS } from './admin-reservation.constant';
import {
  MatTabChangeEvent,
  MatTabGroup,
  MatTabsModule,
} from '@angular/material/tabs';
import { ReservationApiStatus } from '../../landing/landing.enums';
import { AdminReservationTableComponent } from '../admin-reservation-table/admin-reservation-table.component';
import { AdminCreateReservationComponenet } from '../admin-create-reservation/admin-create-reservation.componenet';

@Component({
  selector: 'app-admin-reservation',
  imports: [
    MatTabsModule,
    AdminReservationTableComponent,
    AdminCreateReservationComponenet,
  ],
  templateUrl: './admin-reservation.html',
  styleUrl: './admin-reservation.scss',
})
export class AdminReservation {
  readonly adminReservationConstants = ADMIN_RESERVATION_CONSTANTS;
  readonly reservationApiStatus = ReservationApiStatus;
  selectedIndex = 0;
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
  onTabChange(event: MatTabChangeEvent): void {
    this.selectedIndex = event.index;
  }
  changeTabContent() {
    this.tabGroup.selectedIndex = 1;
  }
}
