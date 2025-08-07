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
import { MatTimepickerModule } from '@angular/material/timepicker';
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
    MatTimepickerModule,
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

  // --- Form State ---
  selectedStartDate: Date | null = null;
  selectedStartTime: Date | null = null;
  selectedEndTime: string | null = null;
  calculatedEndDate: Date | null = null;

  availableApplications: Application[] = [];
  selectedApps: Application[] = [];
  availableDate = '';

  endTimeSlots: string[] = [];

  // --- Configuration ---
  private readonly TIME_SLOT_INCREMENT = 2;
  private readonly MIN_DURATION = 2;
  private readonly MAX_DURATION = 48;

  appConfig: AppConfig | null = null;
  userReservations: Reservation[] = [];
  dailyAvailability: DailyAvailabilityMap = {
    '2025-08-20': 20,
    '2025-08-23': 0,
    '2025-09-01': 30,
  };

  isLoading = false;
  showResultsCard = false;

  ngOnInit(): void {
    this.updateEndTimeSlots();
    this.selectedEndTime = this.endTimeSlots[0];
    this.calculateEndDate();

    const config$ = this.reservationService
      .getConfig()
      .pipe(tap((config) => (this.appConfig = config)));
    const reservations$ = this.reservationService
      .getReservations()
      .pipe(tap((res) => (this.userReservations = res)));
    forkJoin({ config: config$, reservations: reservations$ }).subscribe();
  }

  onDateOrStartTimeChange(): void {
    this.updateEndTimeSlots();
    this.calculateEndDate();
  }

  onEndTimeChange(): void {
    this.calculateEndDate();
  }

  onCheckAvailability(): void {
    if (this.isCheckAvailabilityDisabled()) return;
    this.isLoading = true;
    this.showResultsCard = false;

    const startDateTime = this.getStartDateTime();
    const payload = {
      startTime: startDateTime.toISOString(),
      endTime: this.calculatedEndDate!.toISOString(),
    };

    this.reservationService
      .checkAvailabilityByDate(payload)
      .subscribe((response) => {
        this.availableApplications = response.applications;
        this.selectedApps = [];
        this.availableDate = startDateTime.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
        });
        this.isLoading = false;
        this.showResultsCard = true;
        this.cdr.markForCheck();
      });
  }

  isCheckAvailabilityDisabled(): boolean {
    return (
      this.isLoading ||
      !this.selectedStartDate ||
      !this.selectedStartTime ||
      !this.selectedEndTime ||
      this.showResultsCard
    );
  }

  /**
   * Returns the count of currently selected applications from the results.
   */
  getSelectedAvailableAppCount(): number {
    return this.selectedApps.length;
  }

  isSelected(app: Application): boolean {
    return this.selectedApps.some((selected) => selected.id === app.id);
  }

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

  get selectedAppNames(): string {
    return this.selectedApps.map((app) => app.name).join(', ');
  }

  private updateEndTimeSlots(): void {
    this.endTimeSlots = [];
    if (!this.selectedStartTime) return;
    const startHour24 = this.selectedStartTime.getHours();
    for (
      let duration = this.MIN_DURATION;
      duration <= this.MAX_DURATION;
      duration += this.TIME_SLOT_INCREMENT
    ) {
      const endHour24 = (startHour24 + duration) % 24;
      const formattedTime = this.formatTime12h(endHour24);
      this.endTimeSlots.push(`${formattedTime} (${duration} hrs)`);
    }
    if (!this.endTimeSlots.includes(this.selectedEndTime || '')) {
      this.selectedEndTime = this.endTimeSlots[0];
    }
  }

  private calculateEndDate(): void {
    if (
      this.selectedStartDate &&
      this.selectedStartTime &&
      this.selectedEndTime
    ) {
      const startHour = this.selectedStartTime.getHours();
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

  dateFilter = (date: Date | null): boolean => {
    if (!date || !this.appConfig) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leadTime = this.appConfig.leadTimeDays || 1;
    const minSelectableDate = new Date(
      new Date().setDate(today.getDate() + leadTime)
    );
    if (date < minSelectableDate) return false;
    const maxBookingDays = this.appConfig.maxBookingLeadDays || 30;
    const maxSelectableDate = new Date(
      new Date().setDate(today.getDate() + maxBookingDays)
    );
    if (date > maxSelectableDate) return false;
    const dateString = this.formatDate(date);
    const availabilityCount = this.dailyAvailability[dateString];
    if (availabilityCount === 0) return false;
    for (const reservation of this.userReservations) {
      const startDate = new Date(reservation.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(reservation.endDate);
      endDate.setHours(0, 0, 0, 0);
      if (date >= startDate && date <= endDate) return false;
    }
    return true;
  };

  dateClass = (date: Date): string => {
    const dateString = this.formatDate(date);
    const count = this.dailyAvailability[dateString];
    if (count !== undefined && count === 0) {
      return 'date-unavailable';
    }
    return '';
  };

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTime12h(hour24: number): string {
    const period = hour24 >= 12 ? 'pm' : 'am';
    let hours12 = hour24 % 12;
    if (hours12 === 0) hours12 = 12;
    return `${hours12.toString().padStart(2, '0')}:00 ${period}`;
  }

  private parseDurationFromEndTime(endTimeStr: string): number {
    const match = endTimeStr.match(/\((\d+)\s*hrs\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private getStartDateTime(): Date {
    const startDateTime = new Date(this.selectedStartDate!);
    startDateTime.setHours(this.selectedStartTime!.getHours(), 0, 0, 0);
    return startDateTime;
  }
}
