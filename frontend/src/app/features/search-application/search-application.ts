import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
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
import { Observable, Subscription } from 'rxjs';
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

  applications$!: Observable<Application[]>;
  availabilityApplication?: AvalaibilityByApplication | null;
  minDate: Date;
  maxDate: Date;
  minAllowedTime: string;
  maxAllowedTime: string;
  applicationForm: FormGroup;
  nextHour: number;
  secondaryApplications: Application[] = [];
  nextTimeSlot?: NextAvailableSlots | null;
  primaryApplicationId?: number;
  isCheckAvailabilityLoading = false;
  isCheckAvailableDisabled = false;

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
      selectedApplication: ['', Validators.required],
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
    this.primaryApplicationId = this.applicationForm.get(
      'selectedApplication'
    )?.value;

    const index = this.durations.findIndex(
      (item) =>
        item.value === this.applicationForm.get('selectedDuration')?.value
    );
    const selectedIndex = index <= 0 ? 0 : index - 1;
    const startDateTime: Date = this.applicationForm.get('startTime')?.value;
    const availabilityByApplicationRequest: AvailabilityByApplicationRequest = {
      applicationId: this.applicationForm.get('selectedApplication')?.value,
      startTime: startDateTime.toISOString(),
      durationHours: this.applicationForm.get('selectedDuration')?.value,
      getNextSlots: true,
    };
    const noApplicationAvailableRequest: AvailabilityByApplicationRequest = {
      applicationId: this.applicationForm.get('selectedApplication')?.value,
      startTime: startDateTime.toISOString(),
      durationHours: Number(this.durations[selectedIndex].value),
      getNextSlots: false,
    };
    this.isCheckAvailabilityLoading = true;
    this.isCheckAvailableDisabled = true;
    this.availabilityApplication=null;
    this.secondaryApplications=[];
    this.nextTimeSlot=null;
    this.subscription = this.reservationService
      .checkAvailabilityByApplication(
        availabilityByApplicationRequest,
        noApplicationAvailableRequest
      )
      .subscribe({
        next: (res) => {
          this.isCheckAvailabilityLoading = false;
          if ((res.slotsAvailableData.nextAvailableSlots?.length ?? 0) >= 1) {
            if (res.slotsAvailableData?.requestedSlotAvailable === true) {
              this.nextTimeSlot = res.slotsAvailableData.nextAvailableSlots![0];
              this.checkSecondaryApplications(this.nextTimeSlot!);
              this.availabilityApplication = res.slotsAvailableData;
              this.cdr.detectChanges();
              return;
            }
          }
          if (
            res.noSlotsAvailableData?.requestedSlotAvailable === false &&
            (res.noSlotsAvailableData.nextAvailableSlots?.length ?? 0) >= 1
          ) {
            res.slotsAvailableData.nextAvailableSlots = [
              ...res.slotsAvailableData!.nextAvailableSlots!,
              ...res.noSlotsAvailableData!.nextAvailableSlots!.map((item) => ({
                ...item,
                isLessDurationSlots: true,
              })),
            ];
          }
          this.availabilityApplication = res.slotsAvailableData;

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

  checkSecondaryApplications(nextAvailableSlots: NextAvailableSlots) {
    const uniqueApplications = new Map<number, Application>();
    nextAvailableSlots.availableBots?.forEach((availableBots) => {
      availableBots.applications?.forEach((application) => {
        if (
          !uniqueApplications.has(application.id) &&
          this.applicationForm.get('selectedApplication')?.value !==
            application.id
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
    const selectedApplication = this.secondaryApplications.find(
      (item) => item.id === application.id
    );
    if (selectedApplication) {
      selectedApplication.isSelected = !(application.isSelected ?? false);
    }
    if (
      this.secondaryApplications.filter((item) => item.isSelected === true)
        .length >= 2
    ) {
      this.secondaryApplications = this.secondaryApplications.map((item) => ({
        ...item,
        isEnabled: item.isSelected ? true : false,
      }));
      return;
    }
    const uniqueApplications = new Map<number, Application>();

    this.nextTimeSlot?.availableBots?.forEach((availableBots) => {
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
  }

  onNextAvailableSlotClicked(availableSlot: NextAvailableSlots) {
    this.nextTimeSlot = availableSlot;
    this.checkSecondaryApplications(this.nextTimeSlot!);
    this.availabilityApplication?.nextAvailableSlots?.forEach(
      (item) => (item.isSelected = false)
    );
    availableSlot.isSelected = true;
    this.cdr.detectChanges();
  }
  callMakeReservation() {
    const makeReservationRequest: MakeReservationRequest = {
      primaryApplicationId: this.primaryApplicationId,
      secondaryApplicationsIds: this.secondaryApplications
        .filter((item) => item.isSelected === true)
        .map((item) => item.id),
      startTime: this.nextTimeSlot?.startTime ?? '',
      endTime: this.nextTimeSlot?.endTime ?? '',
    };

    this.reservationService
      .callMakeReservation(makeReservationRequest)
      .subscribe({
        next: (data) => {
          console.log('data======', data);
        },
        error: (err) => {
          this.secondaryApplications = [];
          console.error('error=====', err);
        },
      });
  }

  get lessDurationSlotsList() {
    return this.availabilityApplication?.nextAvailableSlots?.filter(
      (item) => item.isLessDurationSlots === true
    );
  }
  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  showConfirmationDialog() {
    const dialogRef = this.confirmationDialog.open(ConfirmationDialog, {
      width: '43.5rem',
      data: {
        title: 'Are You Sure ?',
        message: 'Do you want to confirm the booking for',
        applications: 'ServiceNow, Box, and Confluence?',
        licenseTitle: 'The requested license(s) will be available on',
        startDateTime: this.nextTimeSlot?.startTime ?? '',
        endDateTime: this.nextTimeSlot?.endTime ?? '',
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
}
