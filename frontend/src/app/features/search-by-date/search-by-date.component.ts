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
import { Application } from '../../core/models/reservation.model';
import { Observable, forkJoin, tap } from 'rxjs';
import { AppConfig } from '../../core/models/appConfig.model';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTimepickerModule } from '@angular/material/timepicker';

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
        MatTimepickerModule,
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

    selectedStartDate: Date | null = null;
    selectedStartTime: Date | null = null;
    selectedEndTime: string | null = null;
    calculatedEndDate: Date | null = null;
    minTime: Date | null = null;
    maxTime: Date | null = null;
    
    minSelectableDay: Date | null = null;
    maxSelectableDate: Date | null = null;

    availableApplications: Application[] = [];
    selectedApps: Application[] = [];
    availableDate = '';

    endTimeSlots: string[] = [];

    // Configuration
    private readonly TIME_SLOT_START_HOUR = 8;
    private readonly TIME_SLOT_END_HOUR = 23;
    private readonly TIME_SLOT_INCREMENT = 2;
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

    isLoading = false;
    showResultsCard = false;

    get selectedDurationHours(): number {
        return this.selectedEndTime
            ? this.parseDurationFromEndTime(this.selectedEndTime)
            : 0;
    }

    ngOnInit(): void {
        this.bootstrap();
    }

    private bootstrap(): void {
        const config$ = this.reservationService.getConfig().pipe(
            tap((cfg) => {
                this.appConfig = cfg;
            })
        );
        const reservations$ = this.reservationService.getReservations().pipe(
            tap((res) => {
                this.userReservations = res;
            })
        );
        forkJoin({ config: config$, reservations: reservations$ }).subscribe(() => {
            this.computeDateBounds();
            this.updateTimepickerBounds();
            this.updateEndTimeSlots();
            this.calculateEndDate();
            this.cdr.markForCheck();
        });
    }

    onDateOrStartTimeChange(): void {
        this.updateTimepickerBounds();
        this.updateEndTimeSlots();
        this.calculateEndDate();
        this.showResultsCard = false;
        this.cdr.markForCheck();
    }

    onEndTimeChange(): void {
        this.calculateEndDate();
        this.cdr.markForCheck();
    }

    onCheckAvailability(): void {
        if (this.isCheckAvailabilityDisabled()) return;

        this.isLoading = true;
        this.showResultsCard = false;
        this.cdr.markForCheck();

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
            }
        });
    }

    onToggleGroupChange(event: { value: Application[] }): void {
        const next = event?.value ?? [];
        this.selectedApps = next.length <= 3 ? [...next] : [...next].slice(0, 3);
        this.cdr.markForCheck();
    }

    isCheckAvailabilityDisabled(): boolean {
        return this.isLoading || !this.selectedStartDate || !this.selectedStartTime || !this.selectedEndTime;
    }

    getSelectedAvailableAppCount(): number {
        return this.selectedApps.length;
    }

    isSelected(app: Application): boolean {
        return this.selectedApps.some((selected) => selected.id === app.id);
    }

    trackByAppId(index: number, app: Application): number {
        return app.id;
    }

    private computeDateBounds(): void {
        const now = new Date();
        const minSelectableDateTime = this.getMinSelectableDateTime(now);
        this.minSelectableDay = new Date(minSelectableDateTime);
        this.minSelectableDay.setHours(0, 0, 0, 0);

        const maxBookingDays = this.appConfig?.maxBookingLeadDays ?? 30;
        this.maxSelectableDate = new Date(now);
        this.maxSelectableDate.setDate(now.getDate() + maxBookingDays);
        this.maxSelectableDate.setHours(23, 59, 59, 999);
    }

    private updateTimepickerBounds(): void {
        if (!this.selectedStartDate) {
            this.minTime = null;
            this.maxTime = null;
            this.selectedStartTime = null;
            return;
        }

        const now = new Date();
        const minSelectableDateTime = this.getMinSelectableDateTime(now);
        const endOfBusinessHours = new Date(this.selectedStartDate);
        endOfBusinessHours.setHours(this.TIME_SLOT_END_HOUR, 0, 0, 0);

        let minStartHour: number;

        if (this.isSameDay(this.selectedStartDate, minSelectableDateTime)) {
            minStartHour = minSelectableDateTime.getHours();
            if (minSelectableDateTime.getMinutes() > 0) {
                minStartHour++;
            }
        } else {
            minStartHour = this.TIME_SLOT_START_HOUR;
        }

        minStartHour = Math.max(minStartHour, this.TIME_SLOT_START_HOUR);

        this.minTime = new Date(this.selectedStartDate);
        this.minTime.setHours(minStartHour, 0, 0);
        this.maxTime = endOfBusinessHours;

        if (this.selectedStartTime === null || this.selectedStartTime < this.minTime) {
            this.selectedStartTime = new Date(this.minTime);
        }
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
            const endHour24 = startHour24 + duration;
            const formattedTime = this.formatTime12h(endHour24 % 24);
            this.endTimeSlots.push(`${formattedTime} (${duration} hrs)`);
        }
        if (!this.endTimeSlots.includes(this.selectedEndTime || '')) {
            this.selectedEndTime = this.endTimeSlots[0] ?? null;
        }
    }

    private calculateEndDate(): void {
        if (this.selectedStartDate && this.selectedStartTime && this.selectedEndTime) {
            const duration = this.parseDurationFromEndTime(this.selectedEndTime);
            const endDateTime = new Date(this.selectedStartTime.getTime() + duration * 60 * 60 * 1000);
            this.calculatedEndDate = endDateTime;
        } else {
            this.calculatedEndDate = null;
        }
    }

    private getMinSelectableDateTime(now: Date): Date {
        const leadTimeDays = this.appConfig?.leadTimeDays || 1;
        const leadTimeHours = leadTimeDays * 24;
        return new Date(now.getTime() + leadTimeHours * 60 * 60 * 1000);
    }

    dateFilter = (date: Date | null): boolean => {
        if (!date || !this.appConfig || !this.minSelectableDay || !this.maxSelectableDate) {
            return false;
        }

        if (date.getTime() < this.minSelectableDay.getTime()) {
            return false;
        }

        if (date.getTime() > this.maxSelectableDate.getTime()) {
            return false;
        }

        const dateString = this.formatDate(date);
        const availabilityCount = this.dailyAvailability[dateString];
        if (availabilityCount !== undefined && availabilityCount === 0) {
            return false;
        }

        for (const reservation of this.userReservations) {
            const reservationStartDay = new Date(reservation.startTime);
            reservationStartDay.setHours(0, 0, 0, 0);
            const reservationEndDay = new Date(reservation.endTime);
            reservationEndDay.setHours(0, 0, 0, 0);

            if (this.isSameDay(date, reservationStartDay) || this.isSameDay(date, reservationEndDay) || (date > reservationStartDay && date < reservationEndDay)) {
                return false;
            }
        }

        return true;
    };

    dateClass = (date: Date): string => {
        const dateString = this.formatDate(date);
        if (this.dailyAvailability[dateString] === 0) return 'date-unavailable';

        for (const reservation of this.userReservations) {
            const reservationStartDay = new Date(reservation.startTime);
            reservationStartDay.setHours(0, 0, 0, 0);
            const reservationEndDay = new Date(reservation.endTime);
            reservationEndDay.setHours(0, 0, 0, 0);

            if (this.isSameDay(date, reservationStartDay) || this.isSameDay(date, reservationEndDay) || (date > reservationStartDay && date < reservationEndDay)) {
                return 'date-unavailable';
            }
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
        if (!this.selectedStartDate || !this.selectedStartTime) {
            throw new Error('Start date or time is not selected.');
        }
        const startDateTime = new Date(this.selectedStartDate);
        startDateTime.setHours(this.selectedStartTime.getHours(), this.selectedStartTime.getMinutes(), 0, 0);
        return startDateTime;
    }
    
    get selectedAppNames(): string {
        return this.selectedApps.map((app) => app.name).join(', ');
    }

    private isSameDay(d1: Date, d2: Date): boolean {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    }
}
