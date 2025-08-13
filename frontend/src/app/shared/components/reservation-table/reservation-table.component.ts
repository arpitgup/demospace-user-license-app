import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  AfterViewInit,
  Input,
  EventEmitter,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';

import { Reservation } from '../../../core/models/reservation.model';
import {
  RESERVATION_TABLE_CONSTANTS,
  ReservationStatus,
} from './reservation-table.constant';
import { ReservationApiStatus } from '../../../features/landing/landing.enums';

@Component({
  selector: 'app-reservation-table',
  standalone: true,
  templateUrl: './reservation-table.component.html',
  styleUrls: ['./reservation-table.component.scss'],
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
    MatPaginatorModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationTableComponent implements AfterViewInit {
  @Output() cancelReservation = new EventEmitter<Reservation>();
  public readonly reservationTableConstants = RESERVATION_TABLE_CONSTANTS;
  public readonly pageSizeOptions: number[] = [5];

  displayedColumns: string[] = ['date', 'applications', 'status', 'action'];
  dataSource = new MatTableDataSource<Reservation>([]);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  @Input() set data(reservations: Reservation[] | null) {
    if (reservations) {
      this.dataSource.data = reservations;

      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    }
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'date':
          return new Date(item.startTime).getTime();
        case 'status':
          return this.getStatus(item);
        default:
          return (item as any)[property];
      }
    };
  }

  /**
   * Formats a date range into "YYYY-MM-DD to YYYY-MM-DD".
   * @param start The start date string from the API.
   * @param end The end date string from the API.
   * @returns The formatted date range string.
   */
  formatDateRange(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const isSameDay =
      startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
      startDate.getUTCMonth() === endDate.getUTCMonth() &&
      startDate.getUTCDate() === endDate.getUTCDate();

    const formatDate = (date: Date, showDate: boolean): string => {
      const options: Intl.DateTimeFormatOptions = showDate
        ? {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
          }
        : {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
          };

      return date.toLocaleString('en-US', options);
    };

    if (isSameDay) {
      const formattedStartDate = formatDate(startDate, true);
      const formattedEndTime = formatDate(endDate, false);
      const formattedStartTimeWithoutDate = formattedStartDate
        .split(',')[1]
        .trim();
      return `${
        formattedStartDate.split(',')[0]
      }, ${formattedStartTimeWithoutDate} – ${formattedEndTime}`;
    } else {
      const formattedStartDate = formatDate(startDate, true);
      const formattedEndDate = formatDate(endDate, true);
      return `${formattedStartDate} – ${formattedEndDate}`;
    }
  }

  /**
   * Determines the reservation status based on the current time.
   * @param reservation The reservation object.
   * @returns The determined reservation status.
   */
  getStatus(reservation: Reservation): ReservationStatus {
    if (
      reservation.status === ReservationApiStatus.COMPLETED ||
      reservation.status === ReservationApiStatus.CANCELLED
    ) {
      return ReservationStatus.PAST;
    } else if (reservation.status === ReservationApiStatus.ACTIVE) {
      return ReservationStatus.CURRENT;
    } else {
      return ReservationStatus.UPCOMING;
    }
  }

  /**
   * Emits the reservation object to the parent component for cancellation.
   * @param reservation The reservation to be cancelled.
   */
  onCancel(reservation: Reservation): void {
    this.cancelReservation.emit(reservation);
  }
}
