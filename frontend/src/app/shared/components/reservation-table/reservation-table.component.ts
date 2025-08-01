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
import { RESERVATION_TABLE_CONSTANTS, ReservationStatus } from './reservation-table.constant';

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
          return new Date(item.startDate).getTime();
        case 'status':
          return this.getStatus(item);
        default:
          return (item as any)[property];
      }
    };
  }

  formatDateRange(start: string, end: string): string {
    const startDate = new Date(start).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const endDate = new Date(end).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startDate} to ${endDate}`;
  }

  getApplications(reservation: Reservation): string[] {
    return [
      reservation.primaryApplicationId,
      ...reservation.additionalApplicationIds,
    ];
  }

  /**
   * Determines the reservation status based on the current time.
   * Now returns a type-safe enum member.
   */
  getStatus(reservation: Reservation): ReservationStatus {
    const now = new Date();
    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);

    if (endDate < now) {
      return ReservationStatus.PAST;
    } else if (startDate <= now && endDate >= now) {
      return ReservationStatus.CURRENT;
    } else {
      return ReservationStatus.UPCOMING;
    }
  }
}
