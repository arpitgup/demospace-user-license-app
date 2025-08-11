import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  inject,
  OnInit,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  FormGroup,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ReservationService } from '../../core/services/reservation.service';
import { Reservation, Application } from '../../core/models/reservation.model';
import { AppConfig } from '../../core/models/appConfig.model';
import { forkJoin, tap } from 'rxjs';

type DailyAvailabilityMap = { [date: string]: number };

@Component({
  selector: 'app-search-by-date',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  form = this.fb.group(
    {
      startDate: [null as Date | null, Validators.required],
      startTime: [
        { value: null as Date | null, disabled: true },
        Validators.required,
      ],
      endTime: [
        { value: null as string | null, disabled: true },
        Validators.required,
      ],
    },
    { validators: this.dateTimeComboValidator() }
  );

  calculatedEndDate: Date | null = null;
  minTime: Date | null = null;
  maxTime: Date | null = null;

  minSelectableDay: Date | null = null;
  maxSelectableDate: Date | null = null;

  availableApplications: Application[] = [];
  selectedApps: Application[] = [];
  availableDate = '';

  endTimeSlots: string[] = [];

  // Config
  private readonly TIME_SLOT_START_HOUR = 8;
  private readonly TIME_SLOT_END_HOUR = 23;
  private readonly TIME_SLOT_INCREMENT = 2;
  private readonly MIN_DURATION = 2;
  private readonly MAX_DURATION = 48;

  // Data for validation
  appConfig: AppConfig | null = null;
  userReservations: Reservation[] = [];
  dailyAvailability: DailyAvailabilityMap = {
    '2025-08-20': 20,
    '2025-08-23': 0,
    '2025-09-01': 30,
  };

  isLoading = false;
  showResultsCard = false;

  get startDateCtrl() {
    return this.form.controls.startDate;
  }
  get startTimeCtrl() {
    return this.form.controls.startTime;
  }
  get endTimeCtrl() {
    return this.form.controls.endTime;
  }

  get selectedDurationHours(): number {
    return this.endTimeCtrl.value
      ? this.parseDurationFromEndTime(this.endTimeCtrl.value)
      : 0;
  }

  ngOnInit(): void {
    this.bootstrap();
    this.startDateCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((date) => {
        if (date) {
          this.startTimeCtrl.enable({ emitEvent: false });
          this.updateTimepickerBounds();
        } else {
          this.startTimeCtrl.reset(
            { value: null, disabled: true },
            { emitEvent: false }
          );
        }
        this.endTimeCtrl.reset(
          { value: null, disabled: true },
          { emitEvent: false }
        );
        this.endTimeSlots = [];
        this.calculateEndDate();
        this.form.updateValueAndValidity({ emitEvent: false });
        this.showResultsCard = false;
        this.cdr.markForCheck();
      });

    this.startTimeCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((time) => {
        if (time) {
          this.endTimeCtrl.enable({ emitEvent: false });
          this.updateEndTimeSlots();
          if (!this.endTimeSlots.includes(this.endTimeCtrl.value || '')) {
            this.endTimeCtrl.setValue(this.endTimeSlots[0] ?? null, {
              emitEvent: true,
            });
          }
        } else {
          this.endTimeCtrl.reset(
            { value: null, disabled: true },
            { emitEvent: false }
          );
          this.endTimeSlots = [];
        }
        this.calculateEndDate();
        this.form.updateValueAndValidity({ emitEvent: false });
        this.showResultsCard = false;
        this.cdr.markForCheck();
      });

    this.endTimeCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.calculateEndDate();
        this.form.updateValueAndValidity({ emitEvent: false });
        this.cdr.markForCheck();
      });

    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const endCtrl = this.endTimeCtrl;
        const keepRequired = endCtrl.errors?.['required']
          ? { required: true }
          : null;

        const gErr = this.form.errors || {};
        const comboKeys = ['invalidEndTimeFormat', 'endBeforeOrEqualStart'];
        const comboOnly = comboKeys.reduce<Record<string, true>>((acc, k) => {
          if ((gErr as any)[k]) acc[k] = true;
          return acc;
        }, {});

        const nextErrors = this.mergeErrors(keepRequired, comboOnly);
        const currentJson = JSON.stringify(endCtrl.errors || null);
        const nextJson = JSON.stringify(nextErrors);
        if (currentJson !== nextJson) endCtrl.setErrors(nextErrors);
      });
  }

  private bootstrap(): void {
    const config$ = this.reservationService
      .getConfig()
      .pipe(tap((cfg) => (this.appConfig = cfg)));
    const reservations$ = this.reservationService
      .getReservations()
      .pipe(tap((res) => (this.userReservations = res)));

    forkJoin({ config: config$, reservations: reservations$ }).subscribe(() => {
      this.computeDateBounds();
      this.updateTimepickerBounds();
      this.updateEndTimeSlots();
      this.calculateEndDate();
      this.cdr.markForCheck();
    });
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
        console.error('Error checking availability:', err);
        this.availableApplications = [];
        this.isLoading = false;
        this.showResultsCard = true;
        this.cdr.markForCheck();
      },
    });
  }

  onToggleGroupChange(event: { value: Application[] }): void {
    const next = event?.value ?? [];
    this.selectedApps = next.length <= 3 ? [...next] : [...next].slice(0, 3);
    this.cdr.markForCheck();
  }

  isCheckAvailabilityDisabled(): boolean {
    console.log('form error : ', this.form.errors);
    return this.isLoading || this.form.invalid || !this.calculatedEndDate;
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
    const selectedStartDate = this.startDateCtrl.value;
    if (!selectedStartDate) {
      this.minTime = null;
      this.maxTime = null;
      return;
    }

    const now = new Date();
    const minSelectableDateTime = this.getMinSelectableDateTime(now);

    const endOfBusinessHours = new Date(selectedStartDate);
    endOfBusinessHours.setHours(this.TIME_SLOT_END_HOUR, 0, 0, 0);

    let minStartHour: number;
    if (this.isSameDay(selectedStartDate, minSelectableDateTime)) {
      minStartHour = minSelectableDateTime.getHours();
      if (minSelectableDateTime.getMinutes() > 0) minStartHour++;
    } else {
      minStartHour = this.TIME_SLOT_START_HOUR;
    }
    minStartHour = Math.max(minStartHour, this.TIME_SLOT_START_HOUR);

    this.minTime = new Date(selectedStartDate);
    this.minTime.setHours(minStartHour, 0, 0);
    this.maxTime = endOfBusinessHours;

    const current = this.startTimeCtrl.value;
    if (!current || current < this.minTime || current > this.maxTime) {
      if (!this.startTimeCtrl.disabled) {
        this.startTimeCtrl.setValue(new Date(this.minTime), {
          emitEvent: true,
        });
      }
    }
  }

  private updateEndTimeSlots(): void {
    this.endTimeSlots = [];
    const startTime = this.startTimeCtrl.value;
    if (!startTime) return;

    const startHour24 = startTime.getHours();
    for (
      let duration = this.MIN_DURATION;
      duration <= this.MAX_DURATION;
      duration += this.TIME_SLOT_INCREMENT
    ) {
      const endHour24 = startHour24 + duration;
      const formattedTime = this.formatTime12h(endHour24 % 24);
      this.endTimeSlots.push(`${formattedTime} (${duration} hrs)`);
    }
  }

  private calculateEndDate(): void {
    const startDate = this.startDateCtrl.value;
    const startTime = this.startTimeCtrl.value;
    const endTimeStr = this.endTimeCtrl.value;

    if (startDate && startTime && endTimeStr) {
      const duration = this.parseDurationFromEndTime(endTimeStr);
      if (!isNaN(duration)) {
        this.calculatedEndDate = new Date(
          startTime.getTime() + duration * 3600_000
        );
        return;
      }
    }
    this.calculatedEndDate = null;
  }

  private getMinSelectableDateTime(now: Date): Date {
    const leadTimeDays = this.appConfig?.leadTimeDays || 1;
    const leadTimeHours = leadTimeDays * 24;
    return new Date(now.getTime() + leadTimeHours * 3600_000);
  }

  dateFilter = (date: Date | null): boolean => {
    if (
      !date ||
      !this.appConfig ||
      !this.minSelectableDay ||
      !this.maxSelectableDate
    )
      return false;

    if (date.getTime() < this.minSelectableDay.getTime()) return false;
    if (date.getTime() > this.maxSelectableDate.getTime()) return false;

    const dateString = this.formatDate(date);
    const availabilityCount = this.dailyAvailability[dateString];
    if (availabilityCount !== undefined && availabilityCount === 0)
      return false;

    for (const reservation of this.userReservations) {
      const reservationStartDay = new Date(reservation.startTime);
      reservationStartDay.setHours(0, 0, 0, 0);
      const reservationEndDay = new Date(reservation.endTime);
      reservationEndDay.setHours(0, 0, 0, 0);

      if (
        this.isSameDay(date, reservationStartDay) ||
        this.isSameDay(date, reservationEndDay) ||
        (date > reservationStartDay && date < reservationEndDay)
      )
        return false;
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

      if (
        this.isSameDay(date, reservationStartDay) ||
        this.isSameDay(date, reservationEndDay) ||
        (date > reservationStartDay && date < reservationEndDay)
      )
        return 'date-unavailable';
    }
    return '';
  };

  private dateTimeComboValidator() {
    const MIN = this.MIN_DURATION;
    const MAX = this.MAX_DURATION;
    const STEP = this.TIME_SLOT_INCREMENT;

    return (group: AbstractControl) => {
      const fg = group as FormGroup;
      const startDate: Date | null = fg.get('startDate')?.value ?? null;
      const startTime: Date | null = fg.get('startTime')?.value ?? null;
      const endTimeLabel: string | null = fg.get('endTime')?.value ?? null;

      if (!startDate || !startTime || !endTimeLabel) return null;

      const duration = this.parseDurationFromEndTime(endTimeLabel);
      const comboErrors: Record<string, true> = {};

      if (isNaN(duration)) {
        comboErrors['invalidEndTimeFormat'] = true;
      } else {
        const startDT = new Date(startDate);
        startDT.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
        const endDT = new Date(startTime.getTime() + duration * 3600_000);
        if (endDT <= startDT) comboErrors['endBeforeOrEqualStart'] = true;
      }

      return Object.keys(comboErrors).length
        ? { dateTimeInvalid: true, ...comboErrors }
        : null;
    };
  }

  private mergeErrors(
    ...errObjs: Array<Record<string, any> | null | undefined>
  ) {
    const merged: Record<string, any> = {};
    for (const e of errObjs) if (e) Object.assign(merged, e);
    return Object.keys(merged).length ? merged : null;
  }

  private getStartDateTime(): Date {
    const startDate = this.startDateCtrl.value!;
    const startTime = this.startTimeCtrl.value!;
    const startDateTime = new Date(startDate);
    startDateTime.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    return startDateTime;
  }

  get selectedAppNames(): string {
    return this.selectedApps.map((app) => app.name).join(', ');
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

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
    if (!endTimeStr) return NaN;
    const s = String(endTimeStr)
      .replace(/\u00A0/g, ' ')
      .trim();
    const m = s.match(/\((\d+)\s*hrs?\)/i);
    return m ? Number(m[1]) : NaN;
  }
}
