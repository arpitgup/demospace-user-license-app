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
import { map, Observable, of, Subscription, switchMap, tap } from 'rxjs';
import { ReservationService } from '../../core/services/reservation.service';
import { Application } from '../../core/models/application.model';
import { AsyncPipe, DatePipe } from '@angular/common';
import { AvailabilityByApplicationRequest } from '../../core/models/availabilityByApplicationRequest.model';
import {
  AvalaibilityByApplication,
  NextAvailableSlots,
} from '../../core/models/availabilityByApplication.model';
import { MakeReservationRequest } from '../../core/models/makeReservationRequest.model';
import { SearchByApplicationLoader } from '../../loaders/search-by-application-loader/search-by-application-loader';
import { ConfirmationDialog } from '../../shared/dialogs/confirmation-dialog/confirmation-dialog';
import { MatDialog } from '@angular/material/dialog';
import { SuccessDialog } from '../../shared/dialogs/success-dialog/success-dialog';

import { ReservationApiStatus } from '../landing/landing.enums';
import { Reservation } from '../../core/models/reservation.model';
import { ErrorDialog } from '../../shared/dialogs/error-dialog/error-dialog';
import {
  getLocalTimeZoneAbbreviation,
  getUniqueSecondaryApplications,
  onApplicationSelected,
} from '../../../utilities/utils';

type NormalizedReservation = { start: Date; end: Date };

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-application.html',
  styleUrl: './search-application.scss',
})
export class SearchApplicationComponent implements OnInit, OnDestroy {
  private reservationService = inject(ReservationService);
  private confirmationDialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private subscription?: Subscription;
  @Output() bookingSuccess = new EventEmitter();

  applications$!: Observable<Application[]>;
  reservations$!: Observable<Reservation[]>;
  availabilityApplication?: AvalaibilityByApplication | null = null;
  minDate: Date;
  maxDate: Date;
  minAllowedTime: string;
  maxAllowedTime: string;
  applicationForm: FormGroup;
  nextHour: number;
  secondaryApplications: Application[] = [];
  selectedTimeSlot?: NextAvailableSlots | null;
  selectedPrimaryApplication?: Application;
  isCheckAvailabilityLoading = false;
  isCheckAvailableDisabled = false;
  selectedApplicationList: string[] = [];
  normalizedReservations: NormalizedReservation[] = [];

  readonly BLOC_HOUR_LIMIT: number = 168;
  readonly MAX_ALLOWED_TIME_VALUE = '23:00';
  readonly MIN_ALLOWED_TIME_VALUE = '00:00';
  readonly PRIMARY_APPLICATION_FORM = 'primaryApplication';
  readonly START_DATE_FORM = 'startDate';
  readonly START_TIME_FORM = 'startTime';
  readonly SELECTED_DURATION_FORM = 'selectedDuration';
  readonly localTimeAbbrevation= getLocalTimeZoneAbbreviation(new Date());


  durations = [
    { value: 2, viewValue: '2 Hours', isDisabled: false },
    { value: 4, viewValue: '4 Hours', isDisabled: false },
    { value: 8, viewValue: '8 Hours', isDisabled: false },
    { value: 12, viewValue: '12 Hours', isDisabled: false },
    { value: 24, viewValue: '24 Hours', isDisabled: false },
    { value: 48, viewValue: '48 Hours', isDisabled: false },
  ];

  private readonly reservationsSig = this.reservationService.reservations;

  constructor(private fb: FormBuilder) {
    this.listenReservationChanges();
    const today = new Date();
    this.minDate = new Date(today);
    this.minDate.setDate(today.getDate() + 1);

    this.maxDate = new Date(today);
    this.maxDate.setDate(today.getDate() + 30);
    this.minAllowedTime = this.MIN_ALLOWED_TIME_VALUE;
    const now = new Date();
    this.nextHour = (now.getHours() + 1) % 24;
    this.maxAllowedTime = this.MAX_ALLOWED_TIME_VALUE;

    this.applicationForm = this.fb.group({
      [this.PRIMARY_APPLICATION_FORM]: ['', Validators.required],
      [this.START_DATE_FORM]: ['', Validators.required],
      [this.START_TIME_FORM]: ['', Validators.required],
      [this.SELECTED_DURATION_FORM]: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.applications$ = this.reservationService.applications$;

    this.applicationForm.valueChanges.subscribe(() => {
      this.isCheckAvailableDisabled = false;
    });
    this.listenDateChanges();
    this.listenTimeChanges();
   
  }

  listenReservationChanges() {
    effect(() => {
      const all = this.reservationsSig();

      const filtered = all.filter(
        (r) =>
          r.status === ReservationApiStatus.PENDING ||
          r.status === ReservationApiStatus.ACTIVE
      );

      this.normalizedReservations = filtered.map((r) => ({
        start: new Date(r.startTime),
        end: new Date(r.endTime),
      }));
    });
  }

  checkAvailability() {
    this.selectedPrimaryApplication = this.applicationForm.get(
      this.PRIMARY_APPLICATION_FORM
    )?.value;

    const selectedDuration = this.applicationForm.get(
      this.SELECTED_DURATION_FORM
    )?.value;
    const startDateTime: Date = this.applicationForm.get(
      this.START_TIME_FORM
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
      (item) => item.value === selectedDuration
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
                availabilityByApplicationRequest
              )
              .pipe(
                map((lessDurationSlotsResponse) => ({
                  slotsAvailableData: slotsAvailabilityResponse,
                  lessDurationSlots: lessDurationSlotsResponse,
                }))
              );
          }
          return of({
            slotsAvailableData: slotsAvailabilityResponse,
            lessDurationSlots: null,
          });
        })
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
            res.slotsAvailableData
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
            error?.error?.detail || 'Something went wrong. Please try again.'
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
      (item) => (item.isSelected = false)
    );
    availableSlot.isSelected = true;
    this.cdr.detectChanges();
  }

  checkSecondaryApplications(nextAvailableSlots: NextAvailableSlots) {
    this.secondaryApplications = getUniqueSecondaryApplications(
      nextAvailableSlots,
      this.selectedPrimaryApplication?.id ?? 0
    );
    this.cdr.detectChanges();
  }

  onApplicationClicked(application: Application) {
    if (this.selectedTimeSlot) {
      this.secondaryApplications = onApplicationSelected(
        application,
        this.secondaryApplications,
        this.selectedTimeSlot!
      );
      this.setSelectedApplicationsValue();
      this.cdr.detectChanges();
    }
  }

  setSelectedApplicationsValue() {
    this.selectedApplicationList.length = 0;
    this.selectedApplicationList.push(
      this.selectedPrimaryApplication?.name ?? ''
    );
    if (this.secondaryApplications?.length >= 0) {
      const selectedApplicationNames = this.secondaryApplications
        .filter((item) => item.isSelected === true)
        .map((item) => item.name);

      this.selectedApplicationList.push(...selectedApplicationNames);
    }
  }

  callMakeReservation() {
    const makeReservationRequest: MakeReservationRequest = {
      primaryApplicationId: this.selectedPrimaryApplication?.id,
      secondaryApplicationIds: this.secondaryApplications
        .filter((item) => item.isSelected === true)
        .map((item) => item.id),
      startTime: this.selectedTimeSlot?.startTime ?? '',
      endTime: this.selectedTimeSlot?.endTime ?? '',
    };
    this.reservationService
      .callMakeReservation(makeReservationRequest)
      .subscribe({
        next: (data) => {
          this.showSuccessDialog();
        },
        error: (err) => {
          this.secondaryApplications = [];
          this.availabilityApplication = null;
          this.selectedTimeSlot = null;
          this.showErrorDialog(
            err?.error?.detail ||
              'There was an error creating your reservation. Please try again.'
          );
        },
      });
  }

  get lessDurationSlotsList() {
    return this.availabilityApplication?.nextAvailableSlots?.filter(
      (item) => item.isLessDurationSlots === true
    );
  }

  listenDateChanges() {
    this.applicationForm
      .get(this.START_DATE_FORM)
      ?.valueChanges.subscribe((newValue) => {
        const startDateTime = new Date(newValue as Date);
        this.durations = this.durations.map((item) => ({
          ...item,
          isDisabled: false,
        }));
        const disableDatesStartEndTime =
          this.isDateExistInDisableDateRanges(startDateTime);

        if (disableDatesStartEndTime.endTime > 0) {
          this.maxAllowedTime =
            disableDatesStartEndTime.endTime.toString().padStart(2, '0') +
            ':00';
        } else {
          this.maxAllowedTime = this.MAX_ALLOWED_TIME_VALUE;
        }
        if (this.isSameDay(newValue, this.minDate)) {
          if (disableDatesStartEndTime.startTime > 0) {
            this.minAllowedTime =
              disableDatesStartEndTime.startTime.toString().padStart(2, '0') +
              ':00';
          } else {
            this.minAllowedTime =
              this.nextHour.toString().padStart(2, '0') + ':00';
          }

          const selectedHour =
            this.applicationForm.get(this.START_TIME_FORM)?.value?.getHours ??
            0;
          if (
            selectedHour >= this.nextHour &&
            selectedHour < disableDatesStartEndTime.endTime
          ) {
            startDateTime.setHours(selectedHour, 0, 0);
          } else {
            startDateTime.setHours(
              this.nextHour < 8 && disableDatesStartEndTime.endTime > 8
                ? 8
                : disableDatesStartEndTime.startTime > this.nextHour
                ? disableDatesStartEndTime.startTime
                : this.nextHour,
              0,
              0
            );
          }
          this.applicationForm
            .get(this.START_TIME_FORM)
            ?.patchValue(startDateTime);
        } else {
          if (disableDatesStartEndTime.startTime > 0) {
            this.minAllowedTime =
              disableDatesStartEndTime.startTime.toString().padStart(2, '0') +
              ':00';
            startDateTime.setHours(disableDatesStartEndTime.startTime, 0, 0);
          } else {
            this.minAllowedTime = this.MIN_ALLOWED_TIME_VALUE;
            startDateTime.setHours(8, 0, 0);
          }

          // if (
          //   this.applicationForm.get(this.START_TIME_FORM)?.value?.getHours ??
          //   0 != 0
          // ) {
          //   startDateTime.setHours(
          //     this.applicationForm.get(this.START_TIME_FORM)?.value?.getHours ?? 0,
          //     0,
          //     0
          //   );
          // } else {

          // }

          this.applicationForm
            .get(this.START_TIME_FORM)
            ?.patchValue(startDateTime);
        }

        this.applicationForm.get(this.START_TIME_FORM)?.markAllAsTouched();
        this.applicationForm.get(this.START_TIME_FORM)?.markAllAsDirty();
      });
  }

  listenTimeChanges() {
    this.applicationForm
      .get(this.START_TIME_FORM)
      ?.valueChanges.subscribe((newValue) => {
        const maxHour =
          new Date(`2025-01-01T${this.maxAllowedTime}:00`).getHours() + 2;
        const selectedDateTime = new Date(newValue);
        const selectedHours = selectedDateTime.getHours();
        for (let slot of this.normalizedReservations) {
          if (this.isSameDay(slot.start, selectedDateTime)) {
            this.durations = this.durations.map((item) => ({
              ...item,
              isDisabled: selectedHours + item.value <= maxHour ? false : true,
            }));
          }
        }

        this.applicationForm
          ?.get(this.SELECTED_DURATION_FORM)
          ?.patchValue(null);
        this.cdr.detectChanges();
      });
  }

  isDateExistInDisableDateRanges(startDateTime: Date): {
    startTime: number;
    endTime: number;
  } {
    let startTime: number = 0;
    let endTime: number = 0;
    for (let slot of this.normalizedReservations) {
      const blocEnd = new Date(
        slot.end.getTime() + this.BLOC_HOUR_LIMIT * 60 * 60 * 1000
      );
      if (
        this.isSameDay(startDateTime, slot.start) &&
        endTime < slot.start.getHours() - 2
      ) {
        endTime = slot.start.getHours() - 2;
      }
      if (
        this.isSameDay(startDateTime, blocEnd) &&
        startTime < blocEnd.getHours()
      ) {
        startTime = blocEnd.getHours();
      }
    }
    return { startTime: startTime, endTime: endTime };
  }

  isSameDay(selectedDate: Date, endDate: Date): boolean {
    return (
      selectedDate.getDate() === endDate.getDate() &&
      selectedDate.getMonth() === endDate.getMonth() &&
      selectedDate.getFullYear() === endDate.getFullYear()
    );
  }

  removeSlotsForBlocDays(slotsAvailableData: AvalaibilityByApplication) {
    slotsAvailableData.nextAvailableSlots =
      slotsAvailableData.nextAvailableSlots?.filter((item) => {
        for (let slot of this.normalizedReservations) {
          const startDate = new Date(item.startTime!);
          const endDate = new Date(item.endTime!);
          const slotEndDate = new Date(
            slot.end.getTime() + this.BLOC_HOUR_LIMIT * 60 * 60 * 1000
          );
          if (
            (startDate >= slot.start && startDate < slotEndDate) ||
            (endDate >= slot.start && endDate <= slotEndDate)
          ) {
            return false;
          }
        }
        return true;
      });
    return slotsAvailableData;
  }

  dateFilter = (date: Date | null): boolean => {
    if (!date) {
      return false;
    }
    const dayOnly = this.stripTime(date);
    const now = new Date();
    const nextDay = new Date();
    nextDay.setDate(now.getDate() + 1);

    for (let slot of this.normalizedReservations) {
      if (
        this.isSameDay(nextDay, date) &&
        this.isSameDay(nextDay, slot.start) &&
        this.nextHour > slot.start.getHours() - 2
      ) {
        return false;
      }
      const blocStart = slot.start;
      const blocEnd = new Date(
        slot.end.getTime() + this.BLOC_HOUR_LIMIT * 60 * 60 * 1000
      );
      if (
        dayOnly > this.stripTime(blocStart) &&
        dayOnly < this.stripTime(blocEnd)
      ) {
        return false;
      }
    }
    return true;
  };

  stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
        message:
          'A confirmation email has been sent to your inbox.<br> Please check your email for the booking details.<br> We’ll see you soon!',
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
