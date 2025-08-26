import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  AfterViewInit,
  Input,
  EventEmitter,
  Output,
  inject,
  OnChanges,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';

import { Reservation } from '../../../core/models/reservation.model';
import { RESERVATION_TABLE_CONSTANTS } from './reservation-table.constant';
import { ReservationApiStatus } from '../../../features/landing/landing.enums';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialog } from '../../dialogs/confirmation-dialog/confirmation-dialog';
import { ReservationTableLoader } from '../../../loaders/reservation-table-loader/reservation-table-loader';
import { TimezoneAbbrPipe } from '../../pipes/timezone-abbr.pipe';

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
    ReservationTableLoader,
    TimezoneAbbrPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationTableComponent implements AfterViewInit, OnChanges {
  @Output() cancelReservation = new EventEmitter<Reservation>();
  public readonly reservationTableConstants = RESERVATION_TABLE_CONSTANTS;
  public readonly pageSizeOptions: number[] = [5];
  public readonly reservationStatus = ReservationApiStatus;
  private confirmationDialog = inject(MatDialog);
  private timezoneAbbrPipe = new TimezoneAbbrPipe();

  displayedColumns: string[] = ['date', 'applications', 'status', 'action'];
  dataSource = new MatTableDataSource<Reservation>([]);
  public isLoading = signal(true);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) set paginator(value: MatPaginator) {
    if (value) {
      this.dataSource.paginator = value;
    }
  }
  private _paginator!: MatPaginator;

  @Input() data: Reservation[] | null = [];

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'date':
          return new Date(item.startTime).getTime();
        case 'status':
          return this.getStatus(item);
        default:
          const value = item[property as keyof Reservation];
          return typeof value === 'string' || typeof value === 'number'
            ? value
            : String(value);
      }
    };
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.isLoading.set(true);
    if (changes['data'] && this.data) {
      this.dataSource.data = this.data;
      this.isLoading.set(false);
      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    }
  }

  /**
   * Formats a date range into "YYYY-MM-DD at hh:mm AM/PM – hh:mm AM/PM (Timezone)" or "YYYY-MM-DD at hh:mm AM/PM (Timezone) – YYYY-MM-DD at hh:mm AM/PM (Timezone)".
   * @param start The start date string from the API.
   * @param end The end date string from the API.
   * @returns The formatted date range string with timezone.
   */
  formatDateRange(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const timeZoneAbbr = this.timezoneAbbrPipe.transform(startDate);

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
      }, ${formattedStartTimeWithoutDate} – ${formattedEndTime} ${timeZoneAbbr}`;
    } else {
      const formattedStartDate = formatDate(startDate, true);
      const formattedEndDate = formatDate(endDate, true);
      return `${formattedStartDate} ${timeZoneAbbr} – ${formattedEndDate} ${timeZoneAbbr}`;
    }
  }

  /**
   * Determines the reservation status based on the current time.
   * @param reservation The reservation object.
   * @returns The determined reservation status.
   */
  getStatus(reservation: Reservation): Partial<string> {
    return reservation.status;
  }

  /**
   * Emits the reservation object to the parent component for cancellation.
   * @param reservation The reservation to be cancelled.
   */
  onCancel(reservation: Reservation): void {
    this.cancelReservation.emit(reservation);
  }

  showConfirmationDialog(reservation: Reservation) {
    const selectedAppNames = reservation.applications
      .map((app) => app.name)
      .join(', ');
    const dialogRef = this.confirmationDialog.open(ConfirmationDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        title: 'Are You Sure ?',
        message: 'Do you want to cancel the booking for',
        applications: `${selectedAppNames}?`,
        licenseTitle: 'Reservation: ',
        startDateTime: reservation?.startTime ?? '',
        endDateTime: reservation?.endTime ?? '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.onCancel(reservation);
      }
    });
  }
}
