import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  inject,
  OnInit,
  ChangeDetectorRef,
  DestroyRef,
  output,
  ViewChild,
  effect,
  signal,
  computed,
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
import { ReservationApiStatus } from '../landing/landing.enums';
import { Application } from '../../core/models/application.model';
import { SearchByApplicationLoader } from '../../loaders/search-by-date-loader/search-by-date-loader';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialog } from '../../shared/dialogs/confirmation-dialog/confirmation-dialog';
import { SuccessDialog } from '../../shared/dialogs/success-dialog/success-dialog';
import { ErrorDialog } from '../../shared/dialogs/error-dialog/error-dialog';

import {
  TIME_SLOT_START_HOUR,
  TIME_SLOT_END_HOUR,
  MIN_DURATION,
  SELF_COOLDOWN_HOURS,
  HIDE_CONFLICTING_END_SLOTS,
  SERVER_TIME_MODE,
  MAX_CALENDAR_DAYS,
  MAX_RESERVATION_APPLICATION,
  DEFAULT_START_DATE_TIME,
  MILLISECONDS_PER_HOUR,
  MIN_LEAD_COOLDOWN_HOURS,
} from './search-by-date.constants';

import {
  formatTime12h,
  parseHourFromTime,
  parseDurationFromEndTime,
  isSameDay,
  formatDate,
  intervalsOverlap,
  normalizeServerTime,
} from './search-by-date.utils';
import { TimezoneAbbrPipe } from '../../shared/pipes/timezone-abbr.pipe';

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
    TimezoneAbbrPipe,
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

  bookingSuccess = output<void>();
  @ViewChild(FormGroupDirective) private formDir?: FormGroupDirective;

  readonly HIDE_CONFLICTING_END_SLOTS = HIDE_CONFLICTING_END_SLOTS;
  private readonly FIXED_END_DURATIONS: number[] = [2, 4, 8, 12, 24, 48];

  dailyAvailability = signal<DailyAvailabilityMap>({});

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

  startTimeSlots = signal<string[]>([]);
  startConflictMap = signal<Record<string, boolean>>({});
  endTimeSlots = signal<string[]>([]);
  endConflictMap = signal<Record<string, boolean>>({});

  private noValidStartOptions = false;
  private noValidEndOptions = false;

  calculatedEndDate = signal<Date | null>(null);

  minSelectableDay: Date | null = null;
  maxSelectableDate: Date | null = null;

  availableApplications = signal<Application[]>([]);
  botsWithApps = signal<BotWithApps[]>([]);
  selectedApps = signal<Application[]>([]);
  availableDate = signal<Date | null>(null);
  revokeDate = signal<Date | null>(null);

  private readonly reservationsSig = this.reservationService.reservations;
  private readonly appConfigSignal = this.reservationService.appConfigData;
  userReservations: Reservation[] = [];
  blockedIntervals: BlockedInterval[] = [];

  isLoading = signal<boolean>(false);
  showResultsCard = signal<boolean>(false);

  get startDateCtrl() {
    return this.form.controls.startDate;
  }
  get startTimeCtrl() {
    return this.form.controls.startTime;
  }
  get endTimeCtrl() {
    return this.form.controls.endTime;
  }
  selectedAppNames = computed<string>(() => {
    return this.selectedApps()
      .map((a) => a.name)
      .join(', ');
  });

  private readonly syncFromReservations = effect(() => {
    const all = this.reservationsSig();
    const filtered = all.filter(
      (r) =>
        r.status === ReservationApiStatus.PENDING ||
        r.status === ReservationApiStatus.ACTIVE
    );
    this.userReservations = filtered as Reservation[];

    const cooldownMs =
      (this.appConfigSignal()?.rollingWindowHours || SELF_COOLDOWN_HOURS) *
      MILLISECONDS_PER_HOUR;
    this.blockedIntervals = filtered.map((r) => {
      const start = normalizeServerTime(r.startTime, SERVER_TIME_MODE);
      const end = normalizeServerTime(r.endTime, SERVER_TIME_MODE);
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
    this.computeDateBounds();
    this.cdr.markForCheck();
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
    if (!date || !this.appConfigSignal()) return false;
    return this.hasFreeSlotOnDate(date);
  };

  dateClass = (date: Date): string =>
    this.hasFreeSlotOnDate(date) ? '' : 'date-unavailable';

  private hasFreeSlotOnDate(date: Date): boolean {
    const ds = formatDate(date);
    const count = this.dailyAvailability()[ds];
    if (count !== undefined && count === 0) return false;

    if (!this.minSelectableDay || !this.maxSelectableDate) return false;

    const earliestHour = this.getMinStartHourForDate(date);
    const latestStartHour = TIME_SLOT_END_HOUR;

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
      this.resetTimeControls();
    }
    this.updateFormState();
  }

  private buildStartTimeSlots(): void {
    const newStartTimeSlots: string[] = [];
    const newStartConflictMap: Record<string, boolean> = {};
    this.noValidStartOptions = false;

    const date = this.startDateCtrl.value as Date | null;
    if (!date) {
      this.startTimeSlots.set([]);
      this.startConflictMap.set({});
      return;
    }

    let hasValid = false;
    const earliestHour = this.getMinStartHourForDate(date);
    const latestStartHour = TIME_SLOT_END_HOUR;

    for (let h = earliestHour; h <= latestStartHour; h++) {
      const start = new Date(date);
      start.setHours(h, 0, 0, 0);
      const label = formatTime12h(h);

      const hasEndOption = this.hasAtLeastOneEndOptionFrom(start);
      const isBlocked = this.overlapsAnyBlockedInterval(
        start,
        new Date(start.getTime() + MIN_DURATION * MILLISECONDS_PER_HOUR)
      );
      const conflicts = isBlocked || !hasEndOption;

      newStartTimeSlots.push(label);
      newStartConflictMap[label] = conflicts;

      if (!conflicts) hasValid = true;
    }

    this.startTimeSlots.set(newStartTimeSlots);
    this.startConflictMap.set(newStartConflictMap);

    if (hasValid) {
      const defaultTime = formatTime12h(DEFAULT_START_DATE_TIME);
      const isDefaultAvailable =
        newStartTimeSlots.includes(defaultTime) &&
        !newStartConflictMap[defaultTime];

      if (isDefaultAvailable) {
        this.startTimeCtrl.setValue(defaultTime, { emitEvent: false });
      } else {
        const firstValid =
          this.startTimeSlots().find((l) => !this.startConflictMap()[l]) ??
          null;
        this.startTimeCtrl.setValue(firstValid, { emitEvent: false });
      }

      this.buildEndTimeSlots();
    } else {
      this.noValidStartOptions = true;
      this.startTimeCtrl.setValue(null, { emitEvent: false });
    }
  }

  private buildEndTimeSlots(): void {
    const newEndTimeSlots: string[] = [];
    const newEndConflictMap: Record<string, boolean> = {};
    this.noValidEndOptions = false;

    const startDate = this.startDateCtrl.value as Date | null;
    const startTimeStr = this.startTimeCtrl.value;

    if (!startDate || !startTimeStr) {
      this.resetEndTimeControls();
      return;
    }

    const start = new Date(startDate);
    const startHour = parseHourFromTime(startTimeStr);
    start.setHours(startHour, 0, 0, 0);

    let hasValid = false;

    for (const d of this.FIXED_END_DURATIONS) {
      const end = new Date(start.getTime() + d * MILLISECONDS_PER_HOUR);
      const endHour = end.getHours();
      const endHourFormatted = formatTime12h(endHour);
      const label = `${endHourFormatted} (${d} hrs)`;

      const conflicts = this.overlapsAnyBlockedInterval(start, end);
      newEndTimeSlots.push(label);
      newEndConflictMap[label] = conflicts;

      if (!conflicts) hasValid = true;
    }

    this.endTimeSlots.set(newEndTimeSlots);
    this.endConflictMap.set(newEndConflictMap);

    if (hasValid) {
      const firstValid =
        this.endTimeSlots().find((l) => !this.endConflictMap()[l]) ?? null;
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
    this.showResultsCard.set(false);
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
    this.startTimeSlots.set([]);
    this.startConflictMap.set({});
    this.endTimeSlots.set([]);
    this.endConflictMap.set({});
    this.noValidStartOptions = false;
    this.noValidEndOptions = false;
  }

  private resetEndTimeControls(): void {
    this.endTimeCtrl.reset(
      { value: null, disabled: true },
      { emitEvent: false }
    );
    this.endTimeSlots.set([]);
    this.endConflictMap.set({});
    this.noValidEndOptions = false;
  }

  private updateFormState(): void {
    this.calculateEndDate();
    this.form.updateValueAndValidity({ emitEvent: false });
    this.showResultsCard.set(false);
    this.cdr.markForCheck();
  }

  private computeDateBounds(): void {
    const now = new Date();
    const minSelectableDateTime = this.getMinSelectableDateTime(now);

    this.minSelectableDay = new Date(minSelectableDateTime);
    this.minSelectableDay.setHours(0, 0, 0, 0);

    const maxBookingDays =
      this.appConfigSignal()?.maxCalendarDays ?? MAX_CALENDAR_DAYS;
    this.maxSelectableDate = new Date(now);
    this.maxSelectableDate.setDate(now.getDate() + maxBookingDays);
    this.maxSelectableDate.setHours(23, 59, 59, 999);
  }

  private getMinSelectableDateTime(now: Date): Date {
    const leadTimeDays = this.appConfigSignal()?.rollingWindowHours || 1;
    const leadTimeHours = leadTimeDays * MIN_LEAD_COOLDOWN_HOURS;
    return new Date(now.getTime() + leadTimeHours * MILLISECONDS_PER_HOUR);
  }

  private getMinStartHourForDate(date: Date): number {
    const minSelectable = this.getMinSelectableDateTime(new Date());
    let hour = TIME_SLOT_START_HOUR;
    if (isSameDay(date, minSelectable)) {
      hour = Math.max(
        hour,
        minSelectable.getHours() + (minSelectable.getMinutes() > 0 ? 1 : 0)
      );
    }
    return hour;
  }

  private hasAtLeastOneEndOptionFrom(start: Date): boolean {
    for (const d of this.FIXED_END_DURATIONS) {
      const end = new Date(start.getTime() + d * MILLISECONDS_PER_HOUR);
      if (!this.overlapsAnyBlockedInterval(start, end)) return true;
    }
    return false;
  }

  onCheckAvailability(): void {
    if (this.isCheckAvailabilityDisabled()) return;

    this.isLoading.set(true);
    this.showResultsCard.set(false);
    this.cdr.markForCheck();

    const startDateTime = this.getStartDateTime();
    const payload = {
      startTime: startDateTime.toISOString(),
      endTime: this.calculatedEndDate()!.toISOString(),
    };

    this.reservationService.checkBotsAvailabilityByDate(payload).subscribe({
      next: (response: { availableBots: BotWithApps[] }) => {
        this.botsWithApps.set(response.availableBots ?? []);
        const appMap = new Map<number, Application>();
        this.botsWithApps().forEach((bot) => {
          bot.applications.forEach((app) => {
            if (!appMap.has(app.id)) {
              appMap.set(app.id, app);
            }
          });
        });

        this.availableApplications.set(Array.from(appMap.values()));
        this.selectedApps.set([]);
        this.availableDate.set(startDateTime);
        this.revokeDate.set(this.calculatedEndDate());
        this.isLoading.set(false);
        this.showResultsCard.set(true);
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        console.error('Error checking bot availability:', err);
        this.availableApplications.set([]);
        this.botsWithApps.set([]);
        this.isLoading.set(false);
        this.showResultsCard.set(true);
        this.cdr.markForCheck();
      },
    });
  }

  showErrorDialog(message: string): void {
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
        applications: `${this.selectedAppNames()}?`,
        licenseTitle: 'The requested license(s) will be available on',
        startDateTime: this.availableDate()?.toISOString() ?? '',
        endDateTime: this.revokeDate()?.toISOString() ?? '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
      },
    });
    dialogRef.afterClosed().subscribe((result: boolean) => {
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
    dialogRef.afterClosed().subscribe((ok: boolean) => {
      if (ok) this.bookingSuccess.emit();
    });
  }

  onToggleGroupChange(event: { value: Application[] }): void {
    const next = event?.value ?? [];
    this.selectedApps.set(
      next.length <= MAX_RESERVATION_APPLICATION
        ? [...next]
        : [...next].slice(0, 3)
    );
    this.cdr.markForCheck();
  }

  isAppToggleDisabled(app: Application): boolean {
    if (this.isSelected(app)) {
      return false;
    }

    if (
      this.selectedApps().length >=
      (this.appConfigSignal()?.maxReservationApplications ||
        MAX_RESERVATION_APPLICATION)
    ) {
      return true;
    }

    if (this.selectedApps().length === 0) {
      return false;
    }

    const selectedAppIds = this.selectedApps().map((a) => a.id);

    const compatibleBots = this.botsWithApps().filter((bot) =>
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
    return this.selectedApps().some((s) => s.id === app.id);
  }

  getSelectedAvailableAppCount(): number {
    return this.selectedApps().length;
  }

  trackByAppId(app: Application): number {
    return app.id;
  }

  onConfirmReservation(): void {
    if (this.selectedApps().length === 0) return;

    const primaryApp = this.selectedApps()[0];
    const secondaryApps = this.selectedApps().slice(1);

    const payload: NewReservation = {
      primaryApplicationId: primaryApp.id,
      secondaryApplicationIds: secondaryApps.map((a) => a.id),
      startTime: this.getStartDateTime().toISOString(),
      endTime: this.calculatedEndDate()!.toISOString(),
    };

    this.reservationService.createReservation(payload).subscribe({
      next: (newReservation: Reservation) => {
        console.log(
          `Reservation successfully created with ID: ${newReservation.id}`
        );
        this.showSuccessDialog();
        this.resetForm();
      },
      error: (err: unknown) => {
        console.error('Failed to create reservation:', err);
        this.showErrorDialog(
          (err as { error: { detail: string } })?.error?.detail ||
            'There was an error creating your reservation. Please try again.'
        );
      },
    });
  }

  isCheckAvailabilityDisabled = computed<boolean>(() => {
    const isInvalid = this.form.invalid;
    const isCalculating = this.isLoading();
    const isEndDateNull = this.calculatedEndDate() === null;
    const isResultsShown = this.showResultsCard();

    return isInvalid || isCalculating || isEndDateNull || isResultsShown;
  });

  private dateTimeComboValidator() {
    return (group: AbstractControl): ValidationErrors | null => {
      const fg = group as FormGroup;
      const startDate: Date | null = fg.get('startDate')?.value ?? null;
      const startTimeStr: string | null = fg.get('startTime')?.value ?? null;
      const endTimeLabel: string | null = fg.get('endTime')?.value ?? null;

      if (!startDate || !startTimeStr || !endTimeLabel) return null;

      const errors: ValidationErrors = {};
      const duration = parseDurationFromEndTime(endTimeLabel);

      if (isNaN(duration)) {
        errors['invalidEndTimeFormat'] = true;
        return { dateTimeInvalid: true, ...errors };
      }

      const startHour = parseHourFromTime(startTimeStr);
      if (isNaN(startHour)) {
        errors['invalidStartTimeFormat'] = true;
        return { dateTimeInvalid: true, ...errors };
      }

      const selStart = new Date(startDate);
      selStart.setHours(startHour, 0, 0, 0);

      const selEnd = new Date(
        selStart.getTime() + duration * MILLISECONDS_PER_HOUR
      );

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

  private overlapsAnyBlockedInterval(selStart: Date, selEnd: Date): boolean {
    if (!this.blockedIntervals.length) return false;
    return this.blockedIntervals.some(({ start, end }) =>
      intervalsOverlap(selStart, selEnd, start, end)
    );
  }

  private calculateEndDate(): void {
    const startDate = this.startDateCtrl.value;
    const startTimeStr = this.startTimeCtrl.value;
    const endTimeStr = this.endTimeCtrl.value;

    if (startDate && startTimeStr && endTimeStr) {
      const startHour = parseHourFromTime(startTimeStr);
      const duration = parseDurationFromEndTime(endTimeStr);
      if (!isNaN(duration) && !isNaN(startHour)) {
        const base = new Date(startDate);
        base.setHours(startHour, 0, 0, 0);
        this.calculatedEndDate.set(
          new Date(base.getTime() + duration * MILLISECONDS_PER_HOUR)
        );
        return;
      }
    }
    this.calculatedEndDate.set(null);
  }

  private getStartDateTime(): Date {
    const startDate = this.startDateCtrl.value!;
    const startTimeStr = this.startTimeCtrl.value!;
    const dt = new Date(startDate);
    const startHour = parseHourFromTime(startTimeStr);
    dt.setHours(startHour, 0, 0, 0);
    return dt;
  }

  private resetForm(): void {
    this.formDir?.resetForm();
    this.form.reset({
      startDate: null,
      startTime: { value: null, disabled: true },
      endTime: { value: null, disabled: true },
    });

    this.startTimeSlots.set([]);
    this.startConflictMap.set({});
    this.endTimeSlots.set([]);
    this.endConflictMap.set({});
    this.calculatedEndDate.set(null);
    this.availableApplications.set([]);
    this.selectedApps.set([]);
    this.botsWithApps.set([]);
    this.showResultsCard.set(false);
    this.noValidStartOptions = false;
    this.noValidEndOptions = false;
    this.cdr.markForCheck();
  }
}
