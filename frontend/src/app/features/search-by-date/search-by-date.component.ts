import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ReservationService } from '../../core/services/reservation.service';
import { Reservation } from '../../core/models/reservation.model';
import { Application } from '../../core/models/application.model';
import { Observable, forkJoin, tap } from 'rxjs';
import { AppConfig } from '../../core/models/appConfig.model';

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
  ],
  templateUrl: './search-by-date.component.html',
  styleUrls: ['./search-by-date.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'en-GB' }],
})
export class SearchByDateComponent implements OnInit {
  private reservationService = inject(ReservationService);

  // --- Component State ---
  appConfig: AppConfig | null = null;
  userReservations: Reservation[] = [];
  applications$!: Observable<Application[]>;
  selectedStartTime: string | null = null;
  endTimeSlots: string[] = [];

  // Data for form controls
  dailyAvailability: DailyAvailabilityMap = {
    '2025-08-20': 20, '2025-08-23': 0, '2025-09-01': 30,
  };
  timeSlots: string[] = [
    '08:00 am (IST)', '09:00 am (IST)', '10:00 am (IST)', '11:00 am (IST)',
    '12:00 pm (IST)', '01:00 pm (IST)', '02:00 pm (IST)', '03:00 pm (IST)',
    '04:00 pm (IST)', '05:00 pm (IST)', '06:00 pm (IST)',
  ];

  ngOnInit(): void {
    const config$ = this.reservationService.getConfig().pipe(tap(config => this.appConfig = config));
    const reservations$ = this.reservationService.getReservations().pipe(tap(res => this.userReservations = res));
    this.applications$ = this.reservationService.getApplications();
    forkJoin({ config: config$, reservations: reservations$ }).subscribe();
  }

  /**
   * Calculates the available end time slots when the start time changes.
   */
  onStartTimeChange(): void {
    if (!this.selectedStartTime) {
      this.endTimeSlots = [];
      return;
    }

    const startHour24 = this.parseTime24h(this.selectedStartTime);
    const durations = [10, 12, 14, 16, 18]; // The required durations in hours

    this.endTimeSlots = durations.map(duration => {
      const endHour24 = (startHour24 + duration) % 24;
      const endTimeFormatted = this.formatTime12h(endHour24);
      return `${endTimeFormatted} (${duration} hrs)`;
    });
  }

  dateFilter = (date: Date | null): boolean => {
    // ... (date filtering logic remains the same)
    if (!date || !this.appConfig) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leadTime = this.appConfig.leadTimeDays || 1;
    const minSelectableDate = new Date(new Date().setDate(today.getDate() + leadTime));
    if (date < minSelectableDate) return false;
    const maxBookingDays = this.appConfig.maxBookingLeadDays || 30;
    const maxSelectableDate = new Date(new Date().setDate(today.getDate() + maxBookingDays));
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
    // ... (date styling logic remains the same)
    const dateString = this.formatDate(date);
    const count = this.dailyAvailability[dateString];
    if (count === undefined) return '';
    return count > 0 ? 'date-available' : 'date-unavailable';
  };

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parses a time string like '08:00 am (IST)' into a 24-hour format number.
   */
  private parseTime24h(timeStr: string): number {
    const [time, period] = timeStr.split(' ');
    let [hours] = time.split(':').map(Number);
    if (period.toLowerCase().startsWith('pm') && hours !== 12) {
      hours += 12;
    }
    if (period.toLowerCase().startsWith('am') && hours === 12) {
      hours = 0;
    }
    return hours;
  }

  /**
   * Formats a 24-hour number into a 12-hour string like '08:00 pm'.
   */
  private formatTime12h(hour24: number): string {
    const period = hour24 >= 12 ? 'pm' : 'am';
    let hours12 = hour24 % 12;
    if (hours12 === 0) {
      hours12 = 12;
    }
    return `${hours12.toString().padStart(2, '0')}:00 ${period}`;
  }
}