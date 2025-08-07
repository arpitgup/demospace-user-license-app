import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  inject,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ReservationService } from '../../core/services/reservation.service';
import { Reservation } from '../../core/models/reservation.model';
import { Application } from '../../core/models/application.model';
import { Observable, forkJoin, tap } from 'rxjs';
import { AppConfig } from '../../core/models/appConfig.model';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

type DailyAvailabilityMap = { [date: string]: number };

@Component({
  selector: 'app-search-by-date',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './search-by-date.component.html',
  styleUrls: ['./search-by-date.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'en-GB' }],
})
export class SearchByDateComponent implements OnInit {
  private reservationService = inject(ReservationService);
  private cdr = inject(ChangeDetectorRef);

  // Form State
  selectedStartDate: Date | null = null;
  selectedStartTime: string | null = null;
  selectedEndTime: string | null = null;
  calculatedEndDate: Date | null = null;

  // Availability Results State
  availableApplications: Application[] = [];
  selectedApps: Application[] = [];
  availableDate = '';

  // Data for Selects
  startTimeSlots: string[] = [];
  endTimeSlots: string[] = [];

  // Configuration
  private readonly TIME_SLOT_START_HOUR = 8;
  private readonly TIME_SLOT_END_HOUR = 23;
  private readonly TIME_SLOT_INCREMENT = 1;
  private readonly MIN_DURATION = 2;
  private readonly MAX_DURATION = 48;

  // Data for Validation
  appConfig: AppConfig | null = null;
  userReservations: Reservation[] = [];
  dailyAvailability: DailyAvailabilityMap = {
    '2025-08-20': 20,
    '2025-08-23': 0,
    '2025-09-01': 30,
  };

  // Component State for UI control
  isLoading = false;
  showResultsCard = false;

  ngOnInit(): void {
    this.getAppConfigAndReservations();
  }

  /**
   * Fetches application configuration and user reservations.
   * Generates initial time slots and sets default selections.
   */
  private getAppConfigAndReservations(): void {
    const config$ = this.reservationService.getConfig().pipe(
      tap((config) => {
        this.appConfig = config;
      })
    );
    const reservations$ = this.reservationService.getReservations().pipe(
      tap((res) => {
        this.userReservations = res;
      })
    );
    forkJoin({ config: config$, reservations: reservations$ }).subscribe(() => {
      this.generateStartTimeSlots();
      if (this.startTimeSlots.length > 0) {
        this.selectedStartTime = this.startTimeSlots[0];
        this.updateEndTimeSlots();
        if (this.endTimeSlots.length > 0) {
          this.selectedEndTime = this.endTimeSlots[0];
          this.calculateEndDate();
        }
      }
      this.cdr.markForCheck();
    });
  }

  /**
   * Handles changes to the date or start time selections.
   */
  onDateOrStartTimeChange(): void {
    this.generateStartTimeSlots();
    this.updateEndTimeSlots();
    this.calculateEndDate();
    this.showResultsCard = false;
  }

  /**
   * Handles changes to the end time selection.
   */
  onEndTimeChange(): void {
    this.calculateEndDate();
  }

  /**
   * Dispatches the API call to check for application availability.
   */
  onCheckAvailability(): void {
    if (this.isCheckAvailabilityDisabled()) return;

    this.isLoading = true;
    this.showResultsCard = false;

    const startDateTime = this.getStartDateTime();
    const payload = {
      startTime: startDateTime.toISOString(),
      endTime: this.calculatedEndDate!.toISOString(),
    };

    this.reservationService.checkAvailabilityByDate(payload).subscribe({
      next: (response) => {
        this.availableApplications = response.applications;
        this.selectedApps = [];
        this.availableDate = startDateTime.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
        });
        this.isLoading = false;
        this.showResultsCard = true;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error checking availability:', err);
        this.availableApplications = [];
        this.showResultsCard = true;
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Determines if the 'Check Availability' button should be disabled.
   */
  isCheckAvailabilityDisabled(): boolean {
    return (
      this.isLoading ||
      !this.selectedStartDate ||
      !this.selectedStartTime ||
      !this.selectedEndTime
    );
  }

  /**
   * Returns the count of currently selected applications.
   */
  getSelectedAvailableAppCount(): number {
    return this.selectedApps.length;
  }

  /**
   * Checks if a given application is currently selected.
   */
  isSelected(app: Application): boolean {
    return this.selectedApps.some((selected) => selected.id === app.id);
  }

  /**
   * Adds or removes an application from the selection list.
   */
  toggleSelection(app: Application): void {
    const index = this.selectedApps.findIndex(
      (selected) => selected.id === app.id
    );
    if (index > -1) {
      this.selectedApps.splice(index, 1);
    } else if (this.selectedApps.length < 3) {
      this.selectedApps.push(app);
    }
  }

  /**
   * Getter to dynamically create a comma-separated string of selected application names.
   */
  get selectedAppNames(): string {
    return this.selectedApps.map((app) => app.name).join(', ');
  }

  /**
   * Generates the time slots for the 'Start Time' dropdown based on the selected date.
   */
  private generateStartTimeSlots(): void {
    this.startTimeSlots = [];
    const now = new Date();
    const minSelectableDateTime = this.getMinSelectableDateTime(now);
    const selectedDate = this.selectedStartDate;

    if (!selectedDate) {
      return;
    }

    let startHour = this.TIME_SLOT_START_HOUR;
    const endHour = this.TIME_SLOT_END_HOUR;

    if (this.isSameDay(selectedDate, minSelectableDateTime)) {
      startHour = minSelectableDateTime.getHours();
      if (minSelectableDateTime.getMinutes() > 0) {
        startHour++;
      }
    } else {
      startHour = this.TIME_SLOT_START_HOUR;
    }

    startHour = Math.max(startHour, this.TIME_SLOT_START_HOUR);

    for (
      let hour = startHour;
      hour <= endHour;
      hour += this.TIME_SLOT_INCREMENT
    ) {
      this.startTimeSlots.push(`${this.formatTime12h(hour)} (IST)`);
    }

    if (
      this.selectedStartTime &&
      !this.startTimeSlots.includes(this.selectedStartTime)
    ) {
      this.selectedStartTime =
        this.startTimeSlots.length > 0 ? this.startTimeSlots[0] : null;
    } else if (!this.selectedStartTime && this.startTimeSlots.length > 0) {
      this.selectedStartTime = this.startTimeSlots[0];
    }
  }

  /**
   * Updates the 'End Time' dropdown options based on the selected start time.
   */
  private updateEndTimeSlots(): void {
    this.endTimeSlots = [];
    if (!this.selectedStartTime) return;
    const startHour24 = this.parseTime24h(this.selectedStartTime);
    for (
      let duration = this.MIN_DURATION;
      duration <= this.MAX_DURATION;
      duration += this.TIME_SLOT_INCREMENT
    ) {
      const endHour24 = startHour24 + duration;
      const formattedTime = this.formatTime12h(endHour24 % 24);
      this.endTimeSlots.push(`${formattedTime} (${duration} hrs)`);
    }
    if (!this.endTimeSlots.includes(this.selectedEndTime || '')) {
      this.selectedEndTime = this.endTimeSlots[0];
    }
  }

  /**
   * Calculates and sets the `calculatedEndDate` based on selected start and end times.
   */
  private calculateEndDate(): void {
    if (
      this.selectedStartDate &&
      this.selectedStartTime &&
      this.selectedEndTime
    ) {
      const startHour = this.parseTime24h(this.selectedStartTime);
      const duration = this.parseDurationFromEndTime(this.selectedEndTime);
      const startDateTime = new Date(this.selectedStartDate);
      startDateTime.setHours(startHour, 0, 0, 0);
      const endDateTime = new Date(
        startDateTime.getTime() + duration * 60 * 60 * 1000
      );
      this.calculatedEndDate = endDateTime;
    } else {
      this.calculatedEndDate = null;
    }
  }

  /**
   * Calculates the minimum selectable date and time based on the lead time.
   */
  private getMinSelectableDateTime(now: Date): Date {
    const leadTimeHours = 24;
    const minSelectableDateTime = new Date(
      now.getTime() + leadTimeHours * 60 * 60 * 1000
    );
    return minSelectableDateTime;
  }

  /**
   * Filter function for the date picker to disable unavailable dates.
   */
  dateFilter = (date: Date | null): boolean => {
    if (!date || !this.appConfig) return false;

    const now = new Date();
    const minSelectableDateTime = this.getMinSelectableDateTime(now);
    const maxBookingDays = this.appConfig.maxBookingLeadDays || 30;

    const minSelectableDay = new Date(minSelectableDateTime);
    minSelectableDay.setHours(0, 0, 0, 0);

    const maxSelectableDate = new Date(now.getTime());
    maxSelectableDate.setDate(now.getDate() + maxBookingDays);
    maxSelectableDate.setHours(23, 59, 59, 999);

    // Disable dates that are before the day of the 24-hour lead time
    if (date.getTime() < minSelectableDay.getTime()) {
      return false;
    }

    // Disable dates that are beyond the max booking period
    if (date.getTime() > maxSelectableDate.getTime()) {
      return false;
    }

    const dateString = this.formatDate(date);
    const availabilityCount = this.dailyAvailability[dateString];
    if (availabilityCount !== undefined && availabilityCount === 0) {
      return false;
    }

    for (const reservation of this.userReservations) {
      const reservationStartDay = new Date(reservation.startDate);
      reservationStartDay.setHours(0, 0, 0, 0);
      const reservationEndDay = new Date(reservation.endDate);
      reservationEndDay.setHours(0, 0, 0, 0);

      if (
        this.isSameDay(date, reservationStartDay) ||
        this.isSameDay(date, reservationEndDay) ||
        (date > reservationStartDay && date < reservationEndDay)
      ) {
        return false;
      }
    }

    return true;
  };

  /**
   * Provides a CSS class for date picker cells with no availability.
   */
  dateClass = (date: Date): string => {
    const dateString = this.formatDate(date);
    const count = this.dailyAvailability[dateString];
    if (count !== undefined && count === 0) {
      return 'date-unavailable';
    }
    return '';
  };

  /**
   * Formats a Date object into a 'YYYY-MM-DD' string.
   */
  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parses a 12-hour time string into a 24-hour number.
   */
  private parseTime24h(timeStr: string): number {
    const parts = timeStr.split(' ');
    const time = parts[0];
    const period = parts[1];
    let [hours] = time.split(':').map(Number);

    const isPM = period.toLowerCase() === 'pm';
    const is12 = hours === 12;

    if (isPM && !is12) {
      hours += 12;
    } else if (!isPM && is12) {
      hours = 0;
    }

    return hours;
  }

  /**
   * Formats a 24-hour number into a 12-hour string (e.g., '14' becomes '02:00 pm').
   */
  private formatTime12h(hour24: number): string {
    const period = hour24 >= 12 ? 'pm' : 'am';
    let hours12 = hour24 % 12;
    if (hours12 === 0) hours12 = 12;
    return `${hours12.toString().padStart(2, '0')}:00 ${period}`;
  }

  /**
   * Extracts the duration in hours from the end time string.
   */
  private parseDurationFromEndTime(endTimeStr: string): number {
    const match = endTimeStr.match(/\((\d+)\s*hrs\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Combines the selected date and start time into a single Date object.
   */
  private getStartDateTime(): Date {
    const startHour = this.parseTime24h(this.selectedStartTime!);
    const startDateTime = new Date(this.selectedStartDate!);
    startDateTime.setHours(startHour, 0, 0, 0);
    return startDateTime;
  }

  /**
   * Checks if two Date objects represent the same day.
   */
  private isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }
}
