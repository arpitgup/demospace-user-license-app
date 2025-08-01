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
import { RESERVATION_TABLE_CONSTANTS } from './reservation-table.constant';

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

  displayedColumns = ['date', 'applications', 'status', 'action'];
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

  /**
   * This lifecycle hook is called once after the view is initialized.
   * This is the correct place to link the paginator and sort to the data source.
   */
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

  getStatus(reservation: Reservation): 'Past' | 'Current' | 'Upcoming' {
    const now = new Date();
    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);

    if (endDate < now) {
      return 'Past';
    } else if (startDate <= now && endDate >= now) {
      return 'Current';
    } else {
      return 'Upcoming';
    }
  }
}
