import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  AfterViewInit,
  Input,
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
    const formatDateToYYYYMMDD_UTC = (date: Date): string => {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startDate = new Date(start);
    const endDate = new Date(end);
    const formattedStartDate = formatDateToYYYYMMDD_UTC(startDate);
    const formattedEndDate = formatDateToYYYYMMDD_UTC(endDate);
    return `${formattedStartDate} to ${formattedEndDate}`;
  }

  /**
   * Determines the reservation status based on the current time.
   * @param reservation The reservation object.
   * @returns The determined reservation status.
   */
  getStatus(reservation: Reservation): ReservationStatus {
    const now = new Date();
    const startTime = new Date(reservation.startTime);
    const endTime = new Date(reservation.endTime);

    if (endTime < now) {
      return ReservationStatus.PAST;
    } else if (startTime <= now && endTime >= now) {
      return ReservationStatus.CURRENT;
    } else {
      return ReservationStatus.UPCOMING;
    }
  }
}
