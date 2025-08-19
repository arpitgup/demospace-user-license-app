import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  inject,
  OnInit,
  ChangeDetectorRef,
  DestroyRef,
  EventEmitter,
  Output,
  ViewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  FormGroup,
  ValidationErrors,
  FormGroupDirective,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ReservationService } from '../../core/services/reservation.service';
import {
  Reservation,
  NewReservation,
  BotWithApps,
} from '../../core/models/reservation.model';
import { AppConfig } from '../../core/models/appConfig.model';
import { ReservationApiStatus } from '../landing/landing.enums';
import { Application } from '../../core/models/application.model';
import { SearchByApplicationLoader } from '../../loaders/search-by-date-loader/search-by-date-loader';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialog } from '../../shared/dialogs/confirmation-dialog/confirmation-dialog';
import { SuccessDialog } from '../../shared/dialogs/success-dialog/success-dialog';
import { ErrorDialog } from '../../shared/dialogs/error-dialog/error-dialog';

type DailyAvailabilityMap = { [date: string]: number };
type BlockedInterval = { start: Date; end: Date };

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
    SearchByApplicationLoader,
  ],
  templateUrl: './search-by-date.component.html',
  styleUrls: ['./search-by-date.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'en-GB' }],
})
export class SearchByDateComponent implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmationDialog = inject(MatDialog);

  @Output() bookingSuccess = new EventEmitter<void>();
  @ViewChild(FormGroupDirective) private formDir?: FormGroupDirective;

  // ===== CONFIG =====
  private readonly SERVER_TIME_MODE: 'utc' | 'local-wall' = 'utc';
  private readonly TIME_SLOT_START_HOUR = 8;
  private readonly TIME_SLOT_END_HOUR = 23;
  private readonly END_SLOT_INCREMENT = 2;
  private readonly MIN_DURATION = 2;
  private readonly MAX_DURATION = 48;

  private readonly SELF_COOLDOWN_HOURS = 1;

  public readonly HIDE_CONFLICTING_END_SLOTS = false;

  dailyAvailability: DailyAvailabilityMap = {};

  form = this.fb.group(
    {
      startDate: [null as Date | null, Validators.required],
      startTime: [
        { value: null as string | null, disabled: true },
        Validators.required,
      ],
      endTime: [
        { value: null as string | null, disabled: true },
        Validators.required,
      ],
    },
    { validators: this.dateTimeComboValidator() }
  );

  startTimeSlots: string[] = [];
  startConflictMap: Record<string, boolean> = {};
  endTimeSlots: string[] = [];
  endConflictMap: Record<string, boolean> = {};
  private noValidStartOptions = false;
  private noValidEndOptions = false;

  calculatedEndDate: Date | null = null;

  minSelectableDay: Date | null = null;
  maxSelectableDate: Date | null = null;

  availableApplications: Application[] = [];
  botsWithApps: BotWithApps[] = [];
  selectedApps: Application[] = [];
  availableDate: Date | null = null;
  revokeDate: Date | null = null;

  appConfig: AppConfig | null = null;

  private readonly reservationsSig = this.reservationService.reservations;
  userReservations: Reservation[] = [];
  blockedIntervals: BlockedInterval[] = [];

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

  private readonly syncFromReservations = effect(() => {
    const all = this.reservationsSig();
    const filtered = all.filter(
      (r) =>
        r.status === ReservationApiStatus.PENDING ||
        r.status === ReservationApiStatus.ACTIVE
    );
    this.userReservations = filtered as Reservation[];

    const cooldownMs = this.SELF_COOLDOWN_HOURS * 3600_000;
    this.blockedIntervals = filtered.map((r) => {
      const start = this.normalizeServerTime(r.startTime);
      const end = this.normalizeServerTime(r.endTime);
      const endWithCooldown = new Date(end.getTime() + cooldownMs);
      return { start, end: endWithCooldown };
    });

    this.buildStartTimeSlots();
    this.buildEndTimeSlots();
    this.calculateEndDate();
    this.form.updateValueAndValidity({ emitEvent: false });
    this.cdr.markForCheck();
  });

  ngOnInit(): void {
    this.resetForm();

    this.reservationService.getConfig().subscribe((cfg) => {
      this.appConfig = cfg;
      this.computeDateBounds();
      this.cdr.markForCheck();
    });

    this.setupFormSubscriptions();
  }

  private setupFormSubscriptions(): void {
    this.startDateCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((date) => {
        this.resetTimeControls();

        if (date) {
          this.startTimeCtrl.enable({ emitEvent: false });
          this.buildStartTimeSlots();
        } else {
          this.startTimeCtrl.reset(
            { value: null, disabled: true },
            { emitEvent: false }
          );
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

  dateFilter = (date: Date | null): boolean => {
    if (!date || !this.appConfig) return false;
    return this.hasFreeSlotOnDate(date);
  };

  dateClass = (date: Date): string =>
    this.hasFreeSlotOnDate(date) ? '' : 'date-unavailable';

  private hasFreeSlotOnDate(date: Date): boolean {
    const ds = this.formatDate(date);
    const count = this.dailyAvailability[ds];
    if (count !== undefined && count === 0) return false;

    if (!this.minSelectableDay || !this.maxSelectableDate) return false;

    const earliestHour = this.getMinStartHourForDate(date);
    const latestStartHour = this.TIME_SLOT_END_HOUR - this.MIN_DURATION;

    for (let h = earliestHour; h <= latestStartHour; h++) {
      const start = new Date(date);
      start.setHours(h, 0, 0, 0);
      if (this.hasAtLeastOneEndOptionFrom(start)) return true;
    }
    return false;
  }

  onStartTimeChange(): void {
    const startTimeStr = this.startTimeCtrl.value;
    if (startTimeStr) {
      this.buildEndTimeSlots();
    } else {
      // Corrected method call from resetEndTimeControls() to resetTimeControls()
      this.resetTimeControls();
    }
    this.updateFormState();
  }

  private buildStartTimeSlots(): void {
    this.startTimeSlots = [];
    this.startConflictMap = {};
    this.noValidStartOptions = false;

    const date = this.startDateCtrl.value as Date | null;
    if (!date) return;

    let hasValid = false;
    const earliestHour = this.getMinStartHourForDate(date);
    const latestStartHour = this.TIME_SLOT_END_HOUR - this.MIN_DURATION;

    for (let h = earliestHour; h <= latestStartHour; h++) {
      const start = new Date(date);
      start.setHours(h, 0, 0, 0);
      const label = this.formatTime12h(h);

      const hasEndOption = this.hasAtLeastOneEndOptionFrom(start);
      const isBlocked = this.overlapsAnyBlockedInterval(
        start,
        new Date(start.getTime() + this.MIN_DURATION * 3600_000)
      );
      const conflicts = isBlocked || !hasEndOption;

      this.startTimeSlots.push(label);
      this.startConflictMap[label] = conflicts;

      if (!conflicts) hasValid = true;
    }

    if (hasValid) {
      const firstValid =
        this.startTimeSlots.find((l) => !this.startConflictMap[l]) ?? null;
      this.startTimeCtrl.setValue(firstValid, { emitEvent: false });
      this.buildEndTimeSlots();
    } else {
      this.noValidStartOptions = true;
      this.startTimeCtrl.setValue(null, { emitEvent: false });
    }
  }

  private buildEndTimeSlots(): void {
    this.endTimeSlots = [];
    this.endConflictMap = {};
    this.noValidEndOptions = false;

    const startDate = this.startDateCtrl.value as Date | null;
    const startTimeStr = this.startTimeCtrl.value;

    if (!startDate || !startTimeStr) {
      this.resetEndTimeControls();
      return;
    }

    const start = new Date(startDate);
    const startHour = this.parseHourFromTime(startTimeStr);
    start.setHours(startHour, 0, 0, 0);

    let hasValid = false;

    for (
      let d = this.MIN_DURATION;
      d <= this.MAX_DURATION;
      d += this.END_SLOT_INCREMENT
    ) {
      const end = new Date(start.getTime() + d * 3600_000);
      const endHour = end.getHours();
      const label = `${this.formatTime12h(endHour)} (${d} hrs)`;

      const conflicts = this.overlapsAnyBlockedInterval(start, end);
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
    this.showResultsCard = false;
    this.syncControlErrors();
    this.cdr.markForCheck();
  }

  private resetTimeControls(): void {
    this.startTimeCtrl.reset(
      { value: null, disabled: true },
      { emitEvent: false }
    );
    this.endTimeCtrl.reset(
      { value: null, disabled: true },
      { emitEvent: false }
    );
    this.startTimeSlots = [];
    this.startConflictMap = {};
    this.endTimeSlots = [];
    this.endConflictMap = {};
    this.noValidStartOptions = false;
    this.noValidEndOptions = false;
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

  private hasAtLeastOneEndOptionFrom(start: Date): boolean {
    for (
      let d = this.MIN_DURATION;
      d <= this.MAX_DURATION;
      d += this.END_SLOT_INCREMENT
    ) {
      const end = new Date(start.getTime() + d * 3600_000);
      if (!this.overlapsAnyBlockedInterval(start, end)) return true;
    }
    return false;
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

    this.reservationService.checkBotsAvailabilityByDate(payload).subscribe({
      next: (response: any) => {
        this.botsWithApps = response?.availableBots ?? [];
        const appMap = new Map<number, Application>();
        this.botsWithApps.forEach((bot: any) => {
          bot.applications.forEach((app: any) => {
            if (!appMap.has(app.id)) {
              appMap.set(app.id, app);
            }
          });
        });

        this.availableApplications = Array.from(appMap.values());
        this.selectedApps = [];
        this.availableDate = startDateTime;
        this.revokeDate = this.calculatedEndDate;
        this.isLoading = false;
        this.showResultsCard = true;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error checking bot availability:', err);
        this.availableApplications = [];
        this.botsWithApps = [];
        this.isLoading = false;
        this.showResultsCard = true;
        this.cdr.markForCheck();
      },
    });
  }

  showErrorDialog(message: string) {
    this.confirmationDialog.open(ErrorDialog, {
      width: 'auto',
      minWidth: '41.86rem',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        message: message,
      },
    });
  }

  showConfirmationDialog(): void {
    const dialogRef = this.confirmationDialog.open(ConfirmationDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        title: 'Are You Sure ?',
        message: 'Do you want to confirm the booking for',
        applications: `${this.selectedAppNames}?`,
        licenseTitle: 'The requested license(s) will be available on',
        startDateTime: this.availableDate!.toISOString() ?? '',
        endDateTime: this.revokeDate!.toISOString() ?? '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.onConfirmReservation();
    });
  }

  showSuccessDialog(): void {
    const dialogRef = this.confirmationDialog.open(SuccessDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        title: 'Success',
        message:
          'A confirmation email has been sent to your inbox.<br> Please check your email for the booking details.<br> We’ll see you soon!',
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed().subscribe((ok) => {
      if (ok) this.bookingSuccess.emit();
    });
  }

  onToggleGroupChange(event: { value: Application[] }): void {
    const next = event?.value ?? [];
    this.selectedApps = next.length <= 3 ? [...next] : [...next].slice(0, 3);
    this.cdr.markForCheck();
  }

  isAppToggleDisabled(app: Application): boolean {
    if (this.isSelected(app)) {
      return false;
    }

    if (this.selectedApps.length >= 3) {
      return true;
    }

    if (this.selectedApps.length === 0) {
      return false;
    }

    const selectedAppIds = this.selectedApps.map((a) => a.id);
    const compatibleBots = this.botsWithApps.filter((bot) =>
      selectedAppIds.every((id) =>
        bot.applications.some((botApp) => botApp.id === id)
      )
    );

    if (compatibleBots.length === 0) {
      return true;
    }

    const availableCompanionAppIds = new Set<number>();
    compatibleBots.forEach((bot) => {
      bot.applications.forEach((botApp) => {
        availableCompanionAppIds.add(botApp.id);
      });
    });

    return !availableCompanionAppIds.has(app.id);
  }

  isSelected(app: Application): boolean {
    return this.selectedApps.some((s) => s.id === app.id);
  }

  getSelectedAvailableAppCount(): number {
    return this.selectedApps.length;
  }

  trackByAppId(app: Application): number {
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
        console.log(
          `Reservation successfully created with ID: ${newReservation.id}`
        );
        this.showSuccessDialog();
        this.resetForm();
      },
      error: (err) => {
        console.error('Failed to create reservation:', err);
        this.showErrorDialog(
          err?.error?.detail ||
            'There was an error creating your reservation. Please try again.'
        );
      },
    });
  }

  isCheckAvailabilityDisabled(): boolean {
    return (
      this.isLoading ||
      this.form.invalid ||
      !this.calculatedEndDate ||
      this.showResultsCard
    );
  }

  private dateTimeComboValidator() {
    return (group: AbstractControl) => {
      const fg = group as FormGroup;
      const startDate: Date | null = fg.get('startDate')?.value ?? null;
      const startTimeStr: string | null = fg.get('startTime')?.value ?? null;
      const endTimeLabel: string | null = fg.get('endTime')?.value ?? null;

      if (!startDate || !startTimeStr || !endTimeLabel) return null;

      const errors: ValidationErrors = {};
      const duration = this.parseDurationFromEndTime(endTimeLabel);

      if (isNaN(duration)) {
        errors['invalidEndTimeFormat'] = true;
        return { dateTimeInvalid: true, ...errors };
      }

      const startHour = this.parseHourFromTime(startTimeStr);
      if (isNaN(startHour)) {
        errors['invalidStartTimeFormat'] = true;
        return { dateTimeInvalid: true, ...errors };
      }

      const selStart = new Date(startDate);
      selStart.setHours(startHour, 0, 0, 0);

      const selEnd = new Date(selStart.getTime() + duration * 3600_000);

      if (selEnd <= selStart) errors['endBeforeOrEqualStart'] = true;
      if (this.overlapsAnyBlockedInterval(selStart, selEnd))
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
    const startCombo = startKeys.reduce<ValidationErrors>((acc, k) => {
      if ((gErr as Record<string, true>)[k]) acc[k] = true;
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
    const endCombo = endKeys.reduce<ValidationErrors>((acc, k) => {
      if ((gErr as Record<string, true>)[k]) acc[k] = true;
      return acc;
    }, {});
    const endErrs = this.mergeErrors(endRequired, endCombo);
    if (JSON.stringify(this.endTimeCtrl.errors) !== JSON.stringify(endErrs)) {
      this.endTimeCtrl.setErrors(endErrs);
    }
  }

  private mergeErrors(
    ...errObjs: Array<ValidationErrors | null | undefined>
  ): ValidationErrors | null {
    const merged: ValidationErrors = {};
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

  private overlapsAnyBlockedInterval(selStart: Date, selEnd: Date): boolean {
    if (!this.blockedIntervals.length) return false;
    return this.blockedIntervals.some(({ start, end }) =>
      this.intervalsOverlap(selStart, selEnd, start, end)
    );
  }

  private calculateEndDate(): void {
    const startDate = this.startDateCtrl.value;
    const startTimeStr = this.startTimeCtrl.value;
    const endTimeStr = this.endTimeCtrl.value;

    if (startDate && startTimeStr && endTimeStr) {
      const startHour = this.parseHourFromTime(startTimeStr);
      const duration = this.parseDurationFromEndTime(endTimeStr);
      if (!isNaN(duration) && !isNaN(startHour)) {
        const base = new Date(startDate);
        base.setHours(startHour, 0, 0, 0);
        this.calculatedEndDate = new Date(base.getTime() + duration * 3600_000);
        return;
      }
    }
    this.calculatedEndDate = null;
  }

  private getStartDateTime(): Date {
    const startDate = this.startDateCtrl.value!;
    const startTimeStr = this.startTimeCtrl.value!;
    const dt = new Date(startDate);
    const startHour = this.parseHourFromTime(startTimeStr);
    dt.setHours(startHour, 0, 0, 0);
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

  private parseHourFromTime(timeStr: string): number {
    const s = String(timeStr)
      .replace(/\u00A0/g, ' ')
      .trim();
    const m = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return NaN;

    let hour = Number(m[1]);
    const period = m[3]?.toUpperCase();

    if (period === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period === 'AM' && hour === 12) {
      hour = 0;
    }
    return hour;
  }

  private parseDurationFromEndTime(endTimeStr: string): number {
    if (!endTimeStr) return NaN;
    const s = String(endTimeStr)
      .replace(/\u00A0/g, ' ')
      .trim();
    const m = s.match(/\((\d+)\s*hrs?\)/i);
    return m ? Number(m[1]) : NaN;
  }

  private resetForm(): void {
    this.formDir?.resetForm();
    this.form.reset({
      startDate: null,
      startTime: { value: null, disabled: true },
      endTime: { value: null, disabled: true },
    });

    this.startTimeSlots = [];
    this.startConflictMap = {};
    this.endTimeSlots = [];
    this.endConflictMap = {};
    this.calculatedEndDate = null;
    this.availableApplications = [];
    this.selectedApps = [];
    this.botsWithApps = [];
    this.showResultsCard = false;
    this.noValidStartOptions = false;
    this.noValidEndOptions = false;
    this.cdr.markForCheck();
  }
}
