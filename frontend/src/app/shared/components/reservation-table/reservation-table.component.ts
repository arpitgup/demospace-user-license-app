import { Component, ChangeDetectionStrategy, ViewChild, AfterViewInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { Reservation } from '../../../core/models/reservation.model';

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
    MatButtonModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationTableComponent implements AfterViewInit {
  @Input() set data(reservations: Reservation[] | null) {
    if (reservations) {
      this.dataSource.data = reservations;
    }
  }

  private now = new Date('2025-07-31T11:49:00Z');

  displayedColumns = ['date', 'applications', 'status', 'action'];
  dataSource = new MatTableDataSource<Reservation>([]);

  @ViewChild(MatSort) sort!: MatSort;

  ngAfterViewInit() {
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

  /**
   * Formats a date range string for display.
   */
  formatDateRange(start: string, end: string): string {
    const startDate = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endDate = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startDate} to ${endDate}`;
  }

  /**
   * Derives the application list from a reservation.
   */
  getApplications(reservation: Reservation): string[] {
    return [reservation.primaryApplicationId, ...reservation.additionalApplicationIds];
  }

  /**
   * Determines the reservation status based on the current time.
   */
  getStatus(reservation: Reservation): 'Past' | 'Current' | 'Upcoming' {
    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);

    if (endDate < this.now) {
      return 'Past';
    } else if (startDate <= this.now && endDate >= this.now) {
      return 'Current';
    } else {
      return 'Upcoming';
    }
  }
}
