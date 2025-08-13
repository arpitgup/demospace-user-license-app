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
import {
  Reservation,
  NewReservation,
} from '../../core/models/reservation.model';
import { AppConfig } from '../../core/models/appConfig.model';
import { forkJoin, tap } from 'rxjs';
import { ReservationApiStatus } from '../landing/landing.enums';
import { Application } from '../../core/models/application.model';
import { SearchByApplicationLoader } from "../../loaders/search-by-date-loader/search-by-date-loader";
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialog } from '../../shared/dialogs/confirmation-dialog/confirmation-dialog';

type DailyAvailabilityMap = { [date: string]: number };
type NormalizedReservation = { start: Date; end: Date };

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
    SearchByApplicationLoader
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
  private confirmationDialog = inject(MatDialog);

  // ===== CONFIG =====
  private readonly SERVER_TIME_MODE: 'utc' | 'local-wall' = 'utc';

  private readonly TIME_SLOT_START_HOUR = 8;
  private readonly TIME_SLOT_END_HOUR = 23;
  private readonly END_SLOT_INCREMENT = 2;
  private readonly MIN_DURATION = 2;
  private readonly MAX_DURATION = 48;

  private readonly SELF_COOLDOWN_DAYS = 7;
  private blackoutDays = new Set<string>();

  readonly HIDE_CONFLICTING_END_SLOTS = false;

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

  endTimeSlots: string[] = [];
  endConflictMap: Record<string, boolean> = {};
  private noValidStartOptions = false;
  private noValidEndOptions = false;

  calculatedEndDate: Date | null = null;

  minTime: Date | null = null;
  maxTime: Date | null = null;

  minSelectableDay: Date | null = null;
  maxSelectableDate: Date | null = null;

  availableApplications: Application[] = [];
  selectedApps: Application[] = [];
  availableDate: Date | null = null;
  revokeDate: Date | null = null;

  appConfig: AppConfig | null = null;
  userReservations: Reservation[] = [];
  normalizedReservations: NormalizedReservation[] = [];
  dailyAvailability: DailyAvailabilityMap = {};

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
  get selectedAppNames(): string {
    return this.selectedApps.map((a) => a.name).join(', ');
  }

  ngOnInit(): void {
    this.bootstrap();
    this.setupFormSubscriptions();
  }

  private setupFormSubscriptions(): void {
    this.startDateCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((date) => {
        this.resetEndTimeControls();

        if (date) {
          this.startTimeCtrl.enable({ emitEvent: false });
          this.updateTimepickerBounds();
        } else {
          this.startTimeCtrl.reset(
            { value: null, disabled: true },
            { emitEvent: false }
          );
        }

        this.updateFormState();
      });

    this.startTimeCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((startTime) => {
        if (startTime) {
          if (!this.hasAtLeastOneEndOptionFrom(startTime)) {
            const date = this.startDateCtrl.value!;
            const next = this.getNextValidStartTimeOnDate(
              date,
              startTime.getHours()
            );
            if (next) {
              this.startTimeCtrl.setValue(next, { emitEvent: true });
              return;
            } else {
              const first = this.getFirstValidStartTimeForDate(date);
              if (first) {
                this.startTimeCtrl.setValue(first, { emitEvent: true });
                return;
              }
              this.resetEndTimeControls();
              this.noValidStartOptions = true;
            }
          } else {
            this.buildEndTimeSlots();
          }
        } else {
          this.resetEndTimeControls();
        }
        this.updateFormState();
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
      .subscribe(() => this.syncControlErrors());
  }

  private resetEndTimeControls(): void {
    this.endTimeCtrl.reset(
      { value: null, disabled: true },
      { emitEvent: false }
    );
    this.endTimeSlots = [];
    this.endConflictMap = {};
    this.noValidEndOptions = false;
  }

  private updateFormState(): void {
    this.calculateEndDate();
    this.form.updateValueAndValidity({ emitEvent: false });
    this.showResultsCard = false;
    this.cdr.markForCheck();
  }

  private bootstrap(): void {
  const config$ = this.reservationService
    .getConfig()
    .pipe(tap((cfg) => (this.appConfig = cfg)));

  const reservations$ = this.reservationService.getReservations().pipe(
    tap((res) => {
      const filteredReservations = res.filter(
        (r) => r.status === ReservationApiStatus.PENDING || r.status === ReservationApiStatus.ACTIVE
      );

      this.userReservations = filteredReservations;

      this.normalizedReservations = filteredReservations.map((r) => ({
        start: this.normalizeServerTime(r.startTime),
        end: this.normalizeServerTime(r.endTime),
      }));

      this.rebuildBlackoutDays();
    })
  );

  forkJoin({ config: config$, reservations: reservations$ }).subscribe(() => {
    this.computeDateBounds();
    this.updateTimepickerBounds();
    this.buildEndTimeSlots();
    this.calculateEndDate();
    this.form.updateValueAndValidity({ emitEvent: false });
    this.cdr.markForCheck();
  });
}

  private normalizeServerTime(iso: string): Date {
    if (this.SERVER_TIME_MODE === 'utc') return new Date(iso);
    const m = iso.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (!m) return new Date(iso);
    const y = +m[1],
      mo = +m[2] - 1,
      d = +m[3],
      h = +m[4],
      min = +m[5],
      s = m[6] ? +m[6] : 0;
    return new Date(y, mo, d, h, min, s, 0);
  }

  private rebuildBlackoutDays(): void {
    this.blackoutDays.clear();
    for (const { start } of this.normalizedReservations) {
      const startDay = new Date(start);
      startDay.setHours(0, 0, 0, 0);
      for (let i = 0; i < this.SELF_COOLDOWN_DAYS; i++) {
        const d = new Date(startDay);
        d.setDate(startDay.getDate() + i);
        this.blackoutDays.add(this.formatDate(d));
      }
    }
  }

  private isInBlackout(date: Date): boolean {
    return this.blackoutDays.has(this.formatDate(date));
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

  private getMinSelectableDateTime(now: Date): Date {
    const leadTimeDays = this.appConfig?.leadTimeDays || 1;
    const leadTimeHours = leadTimeDays * 24;
    return new Date(now.getTime() + leadTimeHours * 3600_000);
  }

  private getMinStartHourForDate(date: Date): number {
    const minSelectable = this.getMinSelectableDateTime(new Date());
    let hour = this.TIME_SLOT_START_HOUR;
    if (this.isSameDay(date, minSelectable)) {
      hour = Math.max(
        hour,
        minSelectable.getHours() + (minSelectable.getMinutes() > 0 ? 1 : 0)
      );
    }
    return hour;
  }

  private hasFreeSlotOnDate(date: Date): boolean {
    if (this.isInBlackout(date)) return false;

    const ds = this.formatDate(date);
    const count = this.dailyAvailability[ds];
    if (count !== undefined && count === 0) return false;

    if (!this.minSelectableDay || !this.maxSelectableDate) return false;

    const earliestHour = this.getMinStartHourForDate(date);
    const latestStartHour = this.TIME_SLOT_END_HOUR - this.MIN_DURATION;

    for (let h = earliestHour; h <= latestStartHour; h++) {
      const start = new Date(date);
      start.setHours(h, 0, 0, 0);
      const end = new Date(start.getTime() + this.MIN_DURATION * 3600_000);
      if (!this.overlapsAnyReservation(start, end)) return true;
    }
    return false;
  }

  dateFilter = (date: Date | null): boolean => {
    if (!date || !this.appConfig) return false;
    return this.hasFreeSlotOnDate(date);
  };

  dateClass = (date: Date): string =>
    this.hasFreeSlotOnDate(date) ? '' : 'date-unavailable';

  /**
   * Compute timepicker min/max AND auto-pick the first valid start for the selected day.
   * Ensures invalid starts (like 08:00 when 08–10 is booked) are not selectable.
   */
  private updateTimepickerBounds(): void {
    const selectedDate = this.startDateCtrl.value;
    if (!selectedDate) {
      this.minTime = null;
      this.maxTime = null;
      return;
    }

    if (this.isInBlackout(selectedDate)) {
      this.minTime = null;
      this.maxTime = null;
      this.startTimeCtrl.setValue(null, { emitEvent: false });
      this.startTimeCtrl.enable({ emitEvent: false });
      this.noValidStartOptions = true;
      return;
    }

    const endOfBusiness = new Date(selectedDate);
    endOfBusiness.setHours(this.TIME_SLOT_END_HOUR, 0, 0, 0);
    this.maxTime = endOfBusiness;

    const firstValid = this.getFirstValidStartTimeForDate(selectedDate);
    if (firstValid) {
      this.minTime = new Date(firstValid);
      const cur = this.startTimeCtrl.value as Date | null;
      const outOfBounds = !cur || cur < this.minTime || cur > this.maxTime;
      if (outOfBounds) {
        this.startTimeCtrl.setValue(new Date(this.minTime), {
          emitEvent: true,
        });
      } else {
        this.buildEndTimeSlots();
      }
    } else {
      this.minTime = null;
      this.startTimeCtrl.setValue(null, { emitEvent: false });
      this.noValidStartOptions = true;
    }
  }

  private getFirstValidStartTimeForDate(date: Date): Date | null {
    if (this.isInBlackout(date)) return null;
    const earliestHour = this.getMinStartHourForDate(date);
    const latestStartHour = this.TIME_SLOT_END_HOUR - this.MIN_DURATION;

    for (let h = earliestHour; h <= latestStartHour; h++) {
      const start = new Date(date);
      start.setHours(h, 0, 0, 0);
      if (this.hasAtLeastOneEndOptionFrom(start)) return start;
    }
    return null;
  }

  private getNextValidStartTimeOnDate(
    date: Date,
    fromHour: number
  ): Date | null {
    if (this.isInBlackout(date)) return null;
    const earliestHour = Math.max(this.getMinStartHourForDate(date), fromHour);
    const latestStartHour = this.TIME_SLOT_END_HOUR - this.MIN_DURATION;

    for (let h = earliestHour; h <= latestStartHour; h++) {
      const start = new Date(date);
      start.setHours(h, 0, 0, 0);
      if (this.hasAtLeastOneEndOptionFrom(start)) return start;
    }
    return null;
  }

  private hasAtLeastOneEndOptionFrom(start: Date): boolean {
    for (
      let d = this.MIN_DURATION;
      d <= this.MAX_DURATION;
      d += this.END_SLOT_INCREMENT
    ) {
      const end = new Date(start.getTime() + d * 3600_000);
      if (!this.overlapsAnyReservation(start, end)) return true;
    }
    return false;
  }

  // ===== END TIME (dropdown) =====
  private buildEndTimeSlots(): void {
    this.endTimeSlots = [];
    this.endConflictMap = {};
    this.noValidEndOptions = false;

    const start = this.startTimeCtrl.value as Date | null;
    if (!start) return;

    let hasValid = false;

    for (
      let d = this.MIN_DURATION;
      d <= this.MAX_DURATION;
      d += this.END_SLOT_INCREMENT
    ) {
      const end = new Date(start.getTime() + d * 3600_000);

      const dayOffset = Math.floor(
        (new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() -
          new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate()
          ).getTime()) /
          86_400_000
      );

      const endHour = end.getHours();
      const label = `${this.formatTime12h(endHour)} (${d} hrs)`;

      const conflicts = this.overlapsAnyReservation(start, end);
      this.endTimeSlots.push(label);
      this.endConflictMap[label] = conflicts;

      if (!conflicts) hasValid = true;
    }

    if (hasValid) {
      const firstValid =
        this.endTimeSlots.find((l) => !this.endConflictMap[l]) ?? null;
      this.endTimeCtrl.enable({ emitEvent: false });
      this.endTimeCtrl.setValue(firstValid, { emitEvent: true });
    } else {
      this.noValidEndOptions = true;
      this.endTimeCtrl.setValue(null, { emitEvent: false });
    }

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
        console.log('checkAvailabilityByDate : ', { response });
        this.availableApplications = response.applications;
        this.selectedApps = [];
        this.availableDate = startDateTime;
        this.revokeDate = this.calculatedEndDate;
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

  showConfirmationDialog() {
    console.log({ revokeDate: this.revokeDate, availableDate: this.availableDate})
      const dialogRef = this.confirmationDialog.open(ConfirmationDialog, {
        width: '43.5rem',
        data: {
          title: 'Are You Sure ?',
          message: 'Do you want to confirm the booking for',
          applications: `${this.selectedAppNames}?`,
          licenseTitle: 'The requested license(s) will be available on',
          startDateTime: this.availableDate!.toISOString(),
          endDateTime: this.revokeDate!.toISOString(),
          confirmText: 'Confirm',
          cancelText: 'Cancel',
        },
      });
      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          this.onConfirmReservation();
        }
      });
    }

  onToggleGroupChange(event: { value: Application[] }): void {
    const next = event?.value ?? [];
    this.selectedApps = next.length <= 3 ? [...next] : [...next].slice(0, 3);
    this.cdr.markForCheck();
  }

  isSelected(app: Application): boolean {
    return this.selectedApps.some((s) => s.id === app.id);
  }

  getSelectedAvailableAppCount(): number {
    return this.selectedApps.length;
  }

  trackByAppId(index: number, app: Application): number {
    return app.id;
  }

  onConfirmReservation(): void {
    if (this.selectedApps.length === 0) return;

    const primaryApp = this.selectedApps[0];
    const secondaryApps = this.selectedApps.slice(1);

    const payload: NewReservation = {
      primaryApplicationId: primaryApp.id,
      secondaryApplicationIds: secondaryApps.map((a) => a.id),
      startTime: this.getStartDateTime().toISOString(),
      endTime: this.calculatedEndDate!.toISOString(),
    };

    this.reservationService.createReservation(payload).subscribe({
      next: (newReservation) => {
        alert(`Reservation successfully created with ID: ${newReservation.id}`);
        this.bootstrap();
      },
      error: (err) => {
        console.error('Failed to create reservation:', err);
        alert(
          err?.error?.detail ||
            'There was an error creating your reservation. Please try again.'
        );
      },
    });
  }

  isCheckAvailabilityDisabled(): boolean {
    return this.isLoading || this.form.invalid || !this.calculatedEndDate || this.showResultsCard;
  }

  private dateTimeComboValidator() {
    return (group: AbstractControl) => {
      const fg = group as FormGroup;
      const startDate: Date | null = fg.get('startDate')?.value ?? null;
      const startTime: Date | null = fg.get('startTime')?.value ?? null;
      const endTimeLabel: string | null = fg.get('endTime')?.value ?? null;

      if (!startDate || !startTime || !endTimeLabel) return null;

      const errors: Record<string, true> = {};
      const duration = this.parseDurationFromEndTime(endTimeLabel);

      if (isNaN(duration)) {
        errors['invalidEndTimeFormat'] = true;
        return { dateTimeInvalid: true, ...errors };
      }

      const selStart = new Date(startDate);
      selStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

      const selEnd = new Date(selStart.getTime() + duration * 3600_000);

      if (selEnd <= selStart) errors['endBeforeOrEqualStart'] = true;
      if (this.overlapsAnyReservation(selStart, selEnd))
        errors['overlapsExisting'] = true;
      if (this.noValidStartOptions) errors['noValidStartTimeOptions'] = true;
      if (this.noValidEndOptions) errors['noValidEndTimeOptions'] = true;

      return Object.keys(errors).length
        ? { dateTimeInvalid: true, ...errors }
        : null;
    };
  }

  private syncControlErrors(): void {
    const gErr = this.form.errors || {};
    const startDateRequired = this.startDateCtrl.errors?.['required']
      ? { required: true }
      : null;
    const startKeys = ['noValidStartTimeOptions'];
    const startCombo = startKeys.reduce<Record<string, true>>((acc, k) => {
      if ((gErr as any)[k]) acc[k] = true;
      return acc;
    }, {});
    const startErrs = this.mergeErrors(startDateRequired, startCombo);
    if (
      JSON.stringify(this.startDateCtrl.errors) !== JSON.stringify(startErrs)
    ) {
      this.startDateCtrl.setErrors(startErrs);
    }

    const endRequired = this.endTimeCtrl.errors?.['required']
      ? { required: true }
      : null;
    const endKeys = [
      'invalidEndTimeFormat',
      'endBeforeOrEqualStart',
      'overlapsExisting',
      'noValidEndTimeOptions',
    ];
    const endCombo = endKeys.reduce<Record<string, true>>((acc, k) => {
      if ((gErr as any)[k]) acc[k] = true;
      return acc;
    }, {});
    const endErrs = this.mergeErrors(endRequired, endCombo);
    if (JSON.stringify(this.endTimeCtrl.errors) !== JSON.stringify(endErrs)) {
      this.endTimeCtrl.setErrors(endErrs);
    }
  }

  private mergeErrors(
    ...errObjs: Array<Record<string, any> | null | undefined>
  ) {
    const merged: Record<string, any> = {};
    for (const e of errObjs) if (e) Object.assign(merged, e);
    return Object.keys(merged).length ? merged : null;
  }

  private intervalsOverlap(
    aStart: Date,
    aEnd: Date,
    bStart: Date,
    bEnd: Date
  ): boolean {
    return aStart < bEnd && aEnd > bStart;
  }

  private overlapsAnyReservation(selStart: Date, selEnd: Date): boolean {
    if (!this.normalizedReservations.length) return false;
    return this.normalizedReservations.some(({ start, end }) =>
      this.intervalsOverlap(selStart, selEnd, start, end)
    );
  }

  private calculateEndDate(): void {
    const startDate = this.startDateCtrl.value;
    const startTime = this.startTimeCtrl.value as Date | null;
    const endTimeStr = this.endTimeCtrl.value;

    if (startDate && startTime && endTimeStr) {
      const duration = this.parseDurationFromEndTime(endTimeStr);
      if (!isNaN(duration)) {
        const base = new Date(startDate);
        base.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
        this.calculatedEndDate = new Date(base.getTime() + duration * 3600_000);
        return;
      }
    }
    this.calculatedEndDate = null;
  }

  private getStartDateTime(): Date {
    const startDate = this.startDateCtrl.value!;
    const startTime = this.startTimeCtrl.value!;
    const dt = new Date(startDate);
    dt.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    return dt;
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatTime12h(hour24: number): string {
    const period = hour24 >= 12 ? 'PM' : 'AM';
    let h = hour24 % 12;
    if (h === 0) h = 12;
    return `${h.toString().padStart(2, '0')}:00 ${period}`;
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
