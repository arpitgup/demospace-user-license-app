import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Output,
  OnInit, OnDestroy,
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
import { map, Observable, Subscription } from 'rxjs';
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
import { start } from 'repl';

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
  @Output() onBookingSuccess = new EventEmitter();

  applications$!: Observable<Application[]>;
  availabilityApplication?: AvalaibilityByApplication | null;
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

  constructor(private fb: FormBuilder) {
    const today = new Date();
    this.minDate = new Date(today);
    this.minDate.setDate(today.getDate() + 1);

    this.maxDate = new Date(today);
    this.maxDate.setDate(today.getDate() + 30);
    this.minAllowedTime = '00:00';
    const now = new Date();
    this.nextHour = (now.getHours() + 1) % 24;
    this.maxAllowedTime = '23:00';

    this.applicationForm = this.fb.group({
      primaryApplication: ['', Validators.required],
      startDate: ['', Validators.required],
      startTime: ['', Validators.required],
      selectedDuration: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.applications$ = this.reservationService.applications$;
    this.applicationForm.valueChanges.subscribe(() => {
      this.isCheckAvailableDisabled = false;
    });

    this.applicationForm
      .get('startDate')
      ?.valueChanges.subscribe((newValue) => {
        const startDateTime = new Date(newValue as Date);
        if (
          newValue.getFullYear() === this.minDate.getFullYear() &&
          newValue.getDate() === this.minDate.getDate() &&
          this.minDate.getMonth() === newValue.getMonth()
        ) {
          this.minAllowedTime =
            this.nextHour < 8
              ? '08:00'
              : this.nextHour.toString().padStart(2, '0') + ':00';
          const selectedHour =
            this.applicationForm.get('startTime')?.value?.getHours ?? 0;
          if (selectedHour >= this.nextHour) {
            startDateTime.setHours(selectedHour, 0, 0);
          } else {
            startDateTime.setHours(this.nextHour < 8 ? 8 : this.nextHour, 0, 0);
          }

          this.applicationForm.get('startTime')?.patchValue(startDateTime);
        } else {
          this.minAllowedTime = '00:00';
          // if (
          //   this.applicationForm.get('startTime')?.value?.getHours ??
          //   0 != 0
          // ) {
          //   startDateTime.setHours(
          //     this.applicationForm.get('startTime')?.value?.getHours ?? 0,
          //     0,
          //     0
          //   );
          // } else {

          // }
          startDateTime.setHours(8, 0, 0);
          this.applicationForm.get('startTime')?.patchValue(startDateTime);
        }
        this.applicationForm.get('startTime')?.markAllAsTouched();
        this.applicationForm.get('startTime')?.markAllAsDirty();
      });
  }

  durations = [
    { value: '2', viewValue: '2 Hours' },
    { value: '4', viewValue: '4 Hours' },
    { value: '8', viewValue: '8 Hours' },
    { value: '12', viewValue: '12 Hours' },
    { value: '24', viewValue: '24 Hours' },
    { value: '48', viewValue: '48 Hours' },
  ];

  checkAvailability() {
    this.selectedPrimaryApplication =
      this.applicationForm.get('primaryApplication')?.value;

    const index = this.durations.findIndex(
      (item) =>
        item.value === this.applicationForm.get('selectedDuration')?.value
    );
    const selectedIndex = index <= 0 ? 0 : index - 1;
    const startDateTime: Date = this.applicationForm.get('startTime')?.value;
    const availabilityByApplicationRequest: AvailabilityByApplicationRequest = {
      applicationId: this.applicationForm.get('primaryApplication')?.value?.id,
      startTime: startDateTime.toISOString(),
      durationHours: this.applicationForm.get('selectedDuration')?.value,
      getNextSlots: true,
    };
    const noApplicationAvailableRequest: AvailabilityByApplicationRequest = {
      applicationId: this.applicationForm.get('primaryApplication')?.value?.id,
      startTime: startDateTime.toISOString(),
      durationHours: Number(this.durations[selectedIndex].value),
      getNextSlots: false,
    };
    this.isCheckAvailabilityLoading = true;
    this.isCheckAvailableDisabled = true;
    this.availabilityApplication = null;
    this.secondaryApplications = [];
    this.selectedTimeSlot = null;
    this.subscription = this.reservationService
      .checkAvailabilityByApplication(
        availabilityByApplicationRequest,
        noApplicationAvailableRequest
      )
      .subscribe({
        next: (res) => {
          this.isCheckAvailabilityLoading = false;
          if ((res.slotsAvailableData.nextAvailableSlots?.length ?? 0) >= 1) {
            this.checkSameDatesSlots(res.slotsAvailableData);
            if (res.slotsAvailableData?.requestedSlotAvailable === true) {
              this.selectedTimeSlot =
                res.slotsAvailableData.nextAvailableSlots![0];
              this.checkSecondaryApplications(this.selectedTimeSlot!);
              this.availabilityApplication = res.slotsAvailableData;
              this.cdr.detectChanges();
              return;
            }
          }
          if (
            res.noSlotsAvailableData?.requestedSlotAvailable === false &&
            (res.noSlotsAvailableData.nextAvailableSlots?.length ?? 0) >= 1
          ) {
            this.checkSameDatesSlots(res.noSlotsAvailableData);
            res.slotsAvailableData.nextAvailableSlots = [
              ...res.slotsAvailableData!.nextAvailableSlots!,
              ...res.noSlotsAvailableData!.nextAvailableSlots!.map((item) => ({
                ...item,
                isLessDurationSlots: true,
              })),
            ];
          }
          this.availabilityApplication = res.slotsAvailableData;
          this.setSelectedApplicationsValue();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.log('resSuccessNot===', err);
          this.secondaryApplications = [];
          this.availabilityApplication = null;
          console.error(err);
          this.isCheckAvailabilityLoading = false;
          this.isCheckAvailableDisabled = false;
          this.cdr.detectChanges();
        },
      });
  }
  checkSameDatesSlots(slotsAvailableData: AvalaibilityByApplication) {
    slotsAvailableData.nextAvailableSlots?.map((slots) => {
      const startDate = new Date(slots.startTime ?? '');
      const endDate = new Date(slots?.endTime ?? '');
      const isSameDay =
        startDate.getFullYear === endDate.getFullYear &&
        startDate.getMonth === endDate.getMonth &&
        startDate.getDate === endDate.getDate;
      return { ...slots, isSameDay: isSameDay };
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
    const uniqueApplications = new Map<number, Application>();
    nextAvailableSlots.availableBots?.forEach((availableBots) => {
      availableBots.applications?.forEach((application) => {
        if (
          !uniqueApplications.has(application.id) &&
          this.selectedPrimaryApplication?.id !== application.id
        ) {
          uniqueApplications.set(application.id, application);
        }
      });
    });
    this.secondaryApplications = Array.from(uniqueApplications.values()).map(
      (item) => ({
        ...item,
        isEnabled: true,
      })
    );
  }

  onApplicationClicked(application: Application) {
    if (
      (application.isSelected ?? false) === false &&
      this.secondaryApplications.filter((item) => item.isSelected === true)
        .length >= 2
    ) {
      return;
    }
    const selectedSecondaryApplications = this.secondaryApplications.find(
      (item) => item.id === application.id
    );
    if (selectedSecondaryApplications) {
      selectedSecondaryApplications.isSelected = !(
        application.isSelected ?? false
      );
    }
    if (
      this.secondaryApplications.filter((item) => item.isSelected === true)
        .length >= 2
    ) {
      this.secondaryApplications = this.secondaryApplications.map((item) => ({
        ...item,
        isEnabled: item.isSelected ? true : false,
      }));
      this.setSelectedApplicationsValue();
      return;
    }
    const uniqueApplications = new Map<number, Application>();

    this.selectedTimeSlot?.availableBots?.forEach((availableBots) => {
      const selectedIds = this.secondaryApplications
        .filter((item) => item.isSelected === true)
        .map((item) => item.id);

      if (
        selectedIds.every((id) =>
          availableBots.applications?.some((item) => item.id == id)
        )
      ) {
        availableBots.applications?.forEach((application) => {
          if (!uniqueApplications.has(application.id)) {
            uniqueApplications.set(application.id, application);
          }
        });
      }
    });
    const availableApplications = Array.from(uniqueApplications.values());
    const availableIds = new Set(availableApplications.map((item) => item.id));
    this.secondaryApplications = this.secondaryApplications.map((item) => ({
      ...item,
      isEnabled: availableIds.has(item.id),
    }));
    this.setSelectedApplicationsValue();
    this.cdr.detectChanges();
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
      console.log('selectedApplications====', selectedApplicationNames);
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
          console.error('error=====', err);
        },
      });
  }

  get lessDurationSlotsList() {
    return this.availabilityApplication?.nextAvailableSlots?.filter(
      (item) => item.isLessDurationSlots === true
    );
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
        this.onBookingSuccess.emit();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
