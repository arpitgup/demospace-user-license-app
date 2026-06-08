import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  EventEmitter,
  inject,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { map, Observable, of, Subscription, switchMap } from 'rxjs';
import { ReservationService } from '../../core/services/reservation.service';
import { Application } from '../../core/models/application.model';
import { AsyncPipe, DatePipe } from '@angular/common';
import { AvailabilityByApplicationRequest } from '../../core/models/availability-by-application-request.model';
import {
  AvalaibilityByApplication,
  NextAvailableSlots,
} from '../../core/models/availability-by-application.model';
import { SearchByApplicationLoader } from '../../loaders/search-by-application-loader/search-by-application-loader';
import { ConfirmationDialog } from '../../shared/dialogs/confirmation-dialog/confirmation-dialog';
import { MatDialog } from '@angular/material/dialog';
import { SuccessDialog } from '../../shared/dialogs/success-dialog/success-dialog';

import { ReservationApiStatus } from '../landing/landing.enums';
import {
  NewReservation,
  Reservation,
} from '../../core/models/reservation.model';
import { ErrorDialog } from '../../shared/dialogs/error-dialog/error-dialog';
import {
  generateHoursList,
  getLocalTimeZoneAbbreviation,
  getUniqueSecondaryApplications,
  onApplicationSelected,
} from '../../../utilities/utils';
import { TimeSlot } from '../../../utilities/interfaces/time_slot';
import { NormalizedReservation } from '../../../utilities/interfaces/normalized_reservation';
import { DEFAULT_START_DATE_TIME } from '../search-by-date/search-by-date.constants';

@Component({
  selector: 'app-search-application',
  providers: [provideNativeDateAdapter()],
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatIconModule,
    MatTimepickerModule,
    MatGridListModule,
    MatDividerModule,
    ReactiveFormsModule,
    AsyncPipe,
    DatePipe,
    SearchByApplicationLoader,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-application.html',
  styleUrl: './search-application.scss',
})
export class SearchApplicationComponent implements OnInit, OnDestroy {
  private reservationService = inject(ReservationService);
  private confirmationDialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private subscription?: Subscription;
  @Output() bookingSuccess = new EventEmitter();

  applications$!: Observable<Application[]>;
  reservations$!: Observable<Reservation[]>;
  availabilityApplication?: AvalaibilityByApplication | null = null;
  secondaryApplications: Application[] = [];
  selectedTimeSlot?: NextAvailableSlots | null;
  selectedPrimaryApplication?: Application;
  isCheckAvailabilityLoading = false;
  isCheckAvailableDisabled = false;
  selectedApplicationList: string[] = [];
  userAllReservations: Reservation[] = [];
  normalizedReservations: NormalizedReservation[] = [];

  BLOC_HOUR_LIMIT: number = 48;
  MAX_CALENDAR_DAYS: number = 30;
  MAX_APPLICATION_SELECTION = 3;
  MIN_LEAD_COOLDOWN_HOURS = 2;
  nextHour: number = 0;
  minDate: Date = new Date();
  maxDate: Date = new Date();
  readonly MAX_ALLOWED_TIME_VALUE = '23:00';
  readonly MIN_ALLOWED_TIME_VALUE = '00:00';
  readonly PRIMARY_APPLICATION_FORM = 'primaryApplication';
  readonly START_DATE_FORM = 'startDate';
  readonly START_TIME_FORM = 'startTime';
  readonly SELECTED_DURATION_FORM = 'selectedDuration';
  readonly localTimeAbbrevation = getLocalTimeZoneAbbreviation(
    new Date(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  hoursList: TimeSlot[] = [];
  readonly today = new Date();

  durations = [
    { value: 2, viewValue: '2 Hours', isDisabled: false, endTime: '' },
    { value: 4, viewValue: '4 Hours', isDisabled: false, endTime: '' },
    { value: 8, viewValue: '8 Hours', isDisabled: false, endTime: '' },
    { value: 12, viewValue: '12 Hours', isDisabled: false, endTime: '' },
    { value: 24, viewValue: '24 Hours', isDisabled: false, endTime: '' },
    { value: 48, viewValue: '48 Hours', isDisabled: false, endTime: '' },
    { value: 72, viewValue: '72 Hours', isDisabled: false, endTime: '' },
  ];

  private readonly reservationsSig = this.reservationService;

  applicationForm: FormGroup = this.fb.group({
    [this.PRIMARY_APPLICATION_FORM]: ['', Validators.required],
    [this.START_DATE_FORM]: [
      { value: '', disabled: true },
      Validators.required,
    ],
    [this.START_TIME_FORM]: [
      { value: '', disabled: true },
      Validators.required,
    ],
    [this.SELECTED_DURATION_FORM]: [
      { value: '', disabled: true },
      [Validators.required],
    ],
  });

  constructor() {
    effect(() => {
      this.userAllReservations = this.reservationsSig.reservations();
    });
    this.listenAppConfig();
  }

  ngOnInit(): void {
    this.minDate = new Date(
      this.today.getTime() + this.MIN_LEAD_COOLDOWN_HOURS * 60 * 60 * 1000,
    );
    this.maxDate = new Date(this.today);
    this.maxDate.setDate(this.today.getDate() + this.MAX_CALENDAR_DAYS);
    this.nextHour = (this.minDate.getHours() + 1) % 24;
    this.hoursList = generateHoursList(
      new Date(),
      [],
      this.BLOC_HOUR_LIMIT,
      this.durations[0].value,
      this.minDate,
    );
    this.applications$ = this.reservationService.applications$;

    this.applicationForm.valueChanges.subscribe(() => {
      this.isCheckAvailableDisabled = false;
    });
    this.listenApplicationChanges();
    this.listenDateChanges();
    this.listenTimeChanges();
    const minDateTime = new Date(this.minDate);
    minDateTime.setHours(this.nextHour, 0, 0, 0);
    this.setDurationEndTime(minDateTime);
  }

  listenReservationChanges() {
    if (this.applicationForm.get(this.PRIMARY_APPLICATION_FORM)?.value) {
      const filtered = this.userAllReservations.filter(
        (r) =>
          (r.applications.some(
            (app) =>
              app.id ===
              (this.applicationForm.get(this.PRIMARY_APPLICATION_FORM)?.value?.id ?? 0),
          )) &&
            (r.status === ReservationApiStatus.PENDING ||
          r.status === ReservationApiStatus.ACTIVE),
      );
      this.normalizedReservations = filtered.map((r) => ({
        start: new Date(r.startTime),
        end: new Date(r.endTime),
      }));
    }
  }

  listenAppConfig() {
    effect(() => {
      const appConfig = this.reservationsSig.appConfigData();
      this.BLOC_HOUR_LIMIT = appConfig?.reservationCoolOffHours || 1;
      this.MAX_CALENDAR_DAYS = appConfig?.maxCalendarDays || 30;
      this.MAX_APPLICATION_SELECTION =
        appConfig?.maxReservationApplications || 3;
      this.MIN_LEAD_COOLDOWN_HOURS = appConfig?.minLeadCooldownHours || 2;
    });
  }

  checkAvailability() {
    this.selectedPrimaryApplication = this.applicationForm.get(
      this.PRIMARY_APPLICATION_FORM,
    )?.value;

    const selectedDuration = this.applicationForm.get(
      this.SELECTED_DURATION_FORM,
    )?.value;
    const startDateTime: Date = this.applicationForm.get(
      this.START_TIME_FORM,
    )?.value;
    const availabilityByApplicationRequest: AvailabilityByApplicationRequest = {
      applicationId: this.applicationForm.get(this.PRIMARY_APPLICATION_FORM)
        ?.value?.id,
      startTime: startDateTime.toISOString(),
      durationHours: selectedDuration,
      getNextSlots: true,
    };

    this.isCheckAvailabilityLoading = true;
    this.isCheckAvailableDisabled = true;
    this.availabilityApplication = null;
    this.secondaryApplications = [];
    this.selectedTimeSlot = null;
    const selectedDurationIndex = this.durations.findIndex(
      (item) => item.value === selectedDuration,
    );
    const lessDurationList =
      selectedDurationIndex > 0
        ? this.durations
            .slice(0, selectedDurationIndex)
            .map((item) => item.value)
        : [];
    this.reservationService
      ?.checkAvailabilityByApplication(availabilityByApplicationRequest)
      .pipe(
        switchMap((slotsAvailabilityResponse) => {
          if (
            slotsAvailabilityResponse.requestedSlotAvailable === false &&
            lessDurationList.length > 1
          ) {
            return this.reservationService
              .checkLessDurationSlotsApplication(
                lessDurationList,
                availabilityByApplicationRequest,
              )
              .pipe(
                map((lessDurationSlotsResponse) => ({
                  slotsAvailableData: slotsAvailabilityResponse,
                  lessDurationSlots: lessDurationSlotsResponse,
                })),
              );
          }
          return of({
            slotsAvailableData: slotsAvailabilityResponse,
            lessDurationSlots: null,
          });
        }),
      )
      .subscribe({
        next: (res) => {
          if ((res.slotsAvailableData.nextAvailableSlots?.length ?? 0) >= 1) {
            if (res.slotsAvailableData?.requestedSlotAvailable === true) {
              this.selectedTimeSlot =
                res.slotsAvailableData.nextAvailableSlots![0];
              this.checkSecondaryApplications(this.selectedTimeSlot!);
            }
          }
          if ((res.lessDurationSlots?.nextAvailableSlots?.length ?? 0) >= 1) {
            res.slotsAvailableData.nextAvailableSlots = [
              ...res.slotsAvailableData!.nextAvailableSlots!,
              ...res.lessDurationSlots!.nextAvailableSlots!.map((item) => ({
                ...item,
                isLessDurationSlots: true,
              })),
            ];
          }
          this.availabilityApplication = this.removeSlotsForBlocDays(
            res.slotsAvailableData,
          );
          if (
            (this.availabilityApplication?.nextAvailableSlots?.length ?? 0) <= 0
          ) {
            this.showErrorDialog('No slots found for selected application');
            return;
          }
          this.checkSameDatesSlots();
          this.setSelectedApplicationsValue();
        },
        complete: () => {
          this.isCheckAvailabilityLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.isCheckAvailabilityLoading = false;
          this.isCheckAvailableDisabled = false;
          this.cdr.detectChanges();
          this.showErrorDialog(
            error?.error?.detail || 'Something went wrong. Please try again.',
          );
        },
      });
  }

  checkSameDatesSlots() {
    this.availabilityApplication?.nextAvailableSlots?.forEach((slot) => {
      const startDate = new Date(slot.startTime ?? '');
      const endDate = new Date(slot?.endTime ?? '');
      slot.isSameDay = startDate.getDate() === endDate.getDate();
    });
  }

  onNextAvailableSlotClicked(availableSlot: NextAvailableSlots) {
    this.selectedTimeSlot = availableSlot;
    this.checkSecondaryApplications(this.selectedTimeSlot!);
    this.availabilityApplication?.nextAvailableSlots?.forEach(
      (item) => (item.isSelected = false),
    );
    availableSlot.isSelected = true;
    this.cdr.detectChanges();
  }

  checkSecondaryApplications(nextAvailableSlots: NextAvailableSlots) {
    this.secondaryApplications = getUniqueSecondaryApplications(
      nextAvailableSlots,
      this.selectedPrimaryApplication?.id ?? 0,
    );

    // Disable secondary applications that are already reserved (PENDING/ACTIVE)
    // in a time range overlapping with the selected slot.
    const slotStart = new Date(nextAvailableSlots.startTime ?? '');
    const slotEnd = new Date(nextAvailableSlots.endTime ?? '');

    const conflictingReservations = this.userAllReservations.filter(
      (r) =>
        (r.status === ReservationApiStatus.PENDING ||
          r.status === ReservationApiStatus.ACTIVE) &&
        new Date(r.startTime) <= slotEnd &&
        new Date(r.endTime) >= slotStart,
    );

    const conflictingAppIds = new Set<number>();
    for (const reservation of conflictingReservations) {
      for (const app of reservation.applications) {
        conflictingAppIds.add(app.id);
      }
    }

    this.secondaryApplications = this.secondaryApplications.map((app) => {
      const isConflicting = conflictingAppIds.has(app.id);
      return {
        ...app,
        isEnabled: !isConflicting,
        disabledReason: isConflicting
          ? 'This license is already reserved for the selected time slot.'
          : undefined,
      };
    });

    this.cdr.detectChanges();
  }

  onApplicationClicked(application: Application) {
    if (this.selectedTimeSlot) {
      this.secondaryApplications = onApplicationSelected(
        application,
        this.secondaryApplications,
        this.selectedTimeSlot!,
        this.MAX_APPLICATION_SELECTION - 1,
      );
      this.setSelectedApplicationsValue();
      this.cdr.detectChanges();
    }
  }

  setSelectedApplicationsValue() {
    this.selectedApplicationList.length = 0;
    this.selectedApplicationList.push(
      this.selectedPrimaryApplication?.name ?? '',
    );
    if (this.secondaryApplications?.length >= 0) {
      const selectedApplicationNames = this.secondaryApplications
        .filter((item) => item.isSelected === true)
        .map((item) => item.name);

      this.selectedApplicationList.push(...selectedApplicationNames);
    }
  }

  callMakeReservation() {
    const payload: NewReservation = {
      primaryApplicationId: this.selectedPrimaryApplication?.id || 0,
      secondaryApplicationIds: this.secondaryApplications
        .filter((item) => item.isSelected === true)
        .map((item) => item.id),
      startTime: this.selectedTimeSlot?.startTime ?? '',
      endTime: this.selectedTimeSlot?.endTime ?? '',
    };

    this.reservationService.createReservation(payload).subscribe({
      next: () => {
        this.showSuccessDialog();
      },
      error: (err) => {
        this.secondaryApplications = [];
        this.availabilityApplication = null;
        this.selectedTimeSlot = null;
        this.isCheckAvailableDisabled = false;
        this.cdr.detectChanges();
        this.showErrorDialog(
          err?.error?.detail ||
            'There was an error creating your reservation. Please try again.',
        );
      },
    });
  }

  get lessDurationSlotsList() {
    return this.availabilityApplication?.nextAvailableSlots?.filter(
      (item) => item.isLessDurationSlots === true,
    );
  }

  listenApplicationChanges() {
    this.applicationForm
      .get(this.PRIMARY_APPLICATION_FORM)
      ?.valueChanges.subscribe((newValue) => {
        if (newValue) {
          this.listenReservationChanges();
          this.applicationForm
            ?.get(this.START_DATE_FORM)
            ?.enable({ emitEvent: false });
          this.applicationForm.get(this.START_DATE_FORM)?.setValue('');
        }
      });
  }
  listenDateChanges() {
    this.applicationForm
      .get(this.START_DATE_FORM)
      ?.valueChanges.subscribe((newValue) => {
        if (newValue) {
          this.applicationForm
            ?.get(this.START_TIME_FORM)
            ?.enable({ emitEvent: false });
        }
        let startDateTime = new Date(newValue as Date);
        this.durations = this.durations.map((item) => ({
          ...item,
          isDisabled: false,
        }));
        const minDateTime = new Date(this.minDate);
        minDateTime.setHours(this.nextHour, 0, 0, 0);
        this.hoursList = generateHoursList(
          startDateTime,
          this.normalizedReservations,
          this.BLOC_HOUR_LIMIT,
          this.durations[0].value,
          minDateTime,
        );
        if (this.hoursList.length > 0) {
          const displayTimeSlot = this.hoursList.find(
            (item) => item.date.getHours() === DEFAULT_START_DATE_TIME,
          );
          const beforeDisplayTimeSlot = [...this.hoursList]
            .reverse()
            .find((item) => item.date.getHours() < DEFAULT_START_DATE_TIME);
          const afterTimeSlot = this.hoursList.find(
            (item) => item.date.getHours() > DEFAULT_START_DATE_TIME,
          );
          if (displayTimeSlot) {
            startDateTime = displayTimeSlot.date;
          } else if (this.isSameDay(newValue, this.minDate)) {
            startDateTime = this.hoursList[0].date;
          } else if (beforeDisplayTimeSlot) {
            startDateTime = beforeDisplayTimeSlot.date;
          } else if (afterTimeSlot) {
            startDateTime = afterTimeSlot.date;
          } else {
            startDateTime = this.hoursList[0].date;
          }
        }
        this.cdr.detectChanges();
        this.applicationForm.get(this.START_TIME_FORM)?.setValue(startDateTime);
      });
  }

  listenTimeChanges() {
    this.applicationForm
      .get(this.START_TIME_FORM)
      ?.valueChanges.subscribe((newValue) => {
        if (newValue === null) {
          return;
        }
        this.applicationForm
          ?.get(this.SELECTED_DURATION_FORM)
          ?.enable({ emitEvent: false });
        const slotSart = new Date(newValue);

        for (let i = 0; i < this.durations.length; i++) {
          const slotEnd = new Date(
            slotSart.getTime() + this.durations[i].value * 60 * 60 * 1000,
          );
          const isDisabled = this.normalizedReservations.some(
            (range) =>
              (slotSart >= range.start && slotSart < range.end) ||
              (slotEnd > range.start && slotEnd <= range.end) ||
              (slotSart <= range.start && slotEnd >= range.end),
          );
          this.durations[i].isDisabled = isDisabled;
        }
        this.setDurationEndTime(slotSart);
        this.applicationForm
          ?.get(this.SELECTED_DURATION_FORM)
          ?.patchValue(null);
        this.cdr.detectChanges();
      });
  }

  isSameDay(selectedDate: Date, endDate: Date): boolean {
    return (
      selectedDate.getDate() === endDate.getDate() &&
      selectedDate.getMonth() === endDate.getMonth() &&
      selectedDate.getFullYear() === endDate.getFullYear()
    );
  }

  removeSlotsForBlocDays(slotsAvailableData: AvalaibilityByApplication) {
    const expandRanges = this.normalizedReservations.map((r) => ({
      start: new Date(r.start),
      end: new Date(r.end.getTime() + this.BLOC_HOUR_LIMIT * 60 * 60 * 1000),
    }));
    slotsAvailableData.nextAvailableSlots =
      slotsAvailableData.nextAvailableSlots?.filter((item) => {
        const startDate = new Date(item.startTime!);
        const endDate = new Date(item.endTime!);
        return !expandRanges.some(
          (range) => startDate < range.end && endDate > range.start,
        );
      });
    return slotsAvailableData;
  }

  dateFilter = (checkDate: Date | null): boolean => {
    if (!checkDate) return false;

    // const now = new Date();
    // const today = new Date();
    // today.setHours(0, 0, 0, 0);

    // const tomorrow = new Date(today);
    // tomorrow.setDate(today.getDate() + 1);
    // tomorrow.setHours(0, 0, 0, 0);

    const minGapHours = this.durations[0].value;

    const dayStart = new Date(checkDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(checkDate);
    dayEnd.setHours(23, 59, 59, 999);

    // if (checkDate.getTime() === min.getTime()) {
    //   const minTomorrow = new Date(now);
    //   minTomorrow.setDate(minTomorrow.getDate() + 1);
    //   if (minTomorrow.getMinutes() > 0) {
    //     minTomorrow.setHours(minTomorrow.getHours() + 1, 0, 0, 0);
    //     if (minTomorrow.getHours() === 0) {
    //       return false;
    //     }
    //   } else {
    //     minTomorrow.setMinutes(0, 0, 0);
    //   }
    //   dayStart.setHours(minTomorrow.getHours(), 0, 0, 0);
    // }

    if (this.isSameDay(checkDate, this.minDate)) {
      const minDateTime = new Date(this.minDate);
      // minTomorrow.setDate(minTomorrow.getDate() + 1);
      if (minDateTime.getMinutes() > 0) {
        minDateTime.setHours(minDateTime.getHours() + 1, 0, 0, 0);
        if (minDateTime.getHours() === 0) {
          return false;
        }
      } else {
        minDateTime.setMinutes(0, 0, 0);
      }
      dayStart.setHours(minDateTime.getHours(), 0, 0, 0);
    }

    const slots = this.normalizedReservations.map((r) => ({
      start: new Date(r.start),
      end: new Date(r.end.getTime() + this.BLOC_HOUR_LIMIT * 60 * 60 * 1000),
    }));

    const dayReservations = slots
      .filter((s) => !(s.end <= dayStart || s.start >= dayEnd))
      .map((s) => ({
        start: new Date(Math.max(s.start.getTime(), dayStart.getTime())),
        end: new Date(Math.min(s.end.getTime(), dayEnd.getTime())),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (dayReservations.length === 0) {
      return true;
    }

    const normalize = (d: Date) => {
      const copy = new Date(d);
      copy.setSeconds(0, 0);
      return copy;
    };

    if (
      (normalize(dayReservations[0].start).getTime() -
        normalize(dayStart).getTime()) /
        36e5 >=
      minGapHours
    ) {
      return true;
    }
    for (let i = 0; i < dayReservations.length - 1; i++) {
      const gap =
        (normalize(dayReservations[i + 1].start).getTime() -
          normalize(dayReservations[i].end).getTime()) /
        36e5;
      if (gap >= minGapHours) return true;
    }

    const last = dayReservations[dayReservations.length - 1];

    const nextDay = new Date(checkDate);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    const nextDayReservations = slots
      .filter((s) => s.start.toDateString() === nextDay.toDateString())
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (nextDayReservations.length > 0) {
      const firstNextDay = nextDayReservations[0];
      const gap =
        (normalize(firstNextDay.start).getTime() -
          normalize(last.end).getTime()) /
        36e5;
      if (gap >= minGapHours) return true;
    } else {
      const gap =
        (normalize(dayEnd).getTime() - normalize(last.end).getTime()) / 36e5;
      if (gap >= 0.9) {
        return true;
      }
    }

    return false;
  };

  setDurationEndTime(minDateTime: Date) {
    this.durations = this.durations.map((item) => {
      const newDate = new Date(
        minDateTime.getTime() + item.value * 60 * 60 * 1000,
      );
      newDate.setMinutes(0);
      const endDateTime = newDate.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return { ...item, endTime: endDateTime };
    });
  }

  showConfirmationDialog() {
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
        applications: `${this.selectedApplicationList?.join(', ')}?`,
        licenseTitle: 'The requested license(s) will be available on',
        startDateTime: this.selectedTimeSlot?.startTime ?? '',
        endDateTime: this.selectedTimeSlot?.endTime ?? '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.callMakeReservation();
      }
    });
  }

  showSuccessDialog() {
    const dialogRef = this.confirmationDialog.open(SuccessDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        title: 'Success',
        message: `A confirmation email has been sent to your <b>DEMO USER's</b> email.<br> Please check email for the booking details.`,
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.bookingSuccess.emit();
      }
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

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
