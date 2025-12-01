import { Component, ViewChild } from '@angular/core';
import {
  MatTabChangeEvent,
  MatTabGroup,
  MatTabsModule,
} from '@angular/material/tabs';
import { ReservationApiStatus } from '../../../landing/landing.enums';
import { AdminReservationTableComponent } from '../admin-reservation-table/admin-reservation-table.component';
import { AdminCreateReservationComponenet } from '../admin-create-reservation/admin-create-reservation.componenet';
import { ReservationConstants } from '../reservation.constants';

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
  readonly adminReservationConstants = ReservationConstants;
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
