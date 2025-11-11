import {
  Component,
  EventEmitter,
  inject,
  OnInit,
  Output,
  PLATFORM_ID,
  signal,
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
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  isNextDay,
  isSameDay,
} from '../../../search-by-date/search-by-date.utils';
import { getLocalTimeZoneAbbreviation } from '../../../../../utilities/utils';
import { SearchByApplicationLoader } from '../../../../loaders/search-by-application-loader/search-by-application-loader';
import { AdminCreateReservationLoaderComponent } from '../../../../loaders/admin-create-reservation-loader/admin-create-reservation-loader.component';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import { AdminService } from '../../../../core/services/admin.service';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialog } from '../../../../shared/dialogs/error-dialog/error-dialog';
import { LoaderService } from '../../../../core/services/loading.service';
import { Application } from '../../../../core/models/application.model';
import { SuccessDialog } from '../../../../shared/dialogs/success-dialog/success-dialog';
import { AdminCreateReservationRequest } from '../../../../core/models/admin-create-reservation-request.model';

@Component({
  selector: 'app-admin-create-reservation',
  providers: [provideNativeDateAdapter()],
  imports: [
    MatCardModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatDatepickerModule,
    MatTimepickerModule,
    MatIconModule,
    MatButtonModule,
    DatePipe,
    AdminCreateReservationLoaderComponent,
    SearchByApplicationLoader,
    ErrorMessage,
  ],
  templateUrl: './admin-create-reservation.componenet.html',
  styleUrl: './admin-create-reservation.componenet.scss',
})
export class AdminCreateReservationComponenet implements OnInit {
  private fb = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID);
  private adminService = inject(AdminService);
  readonly USER_EMAIL_FORM = 'userEmail';
  readonly START_DATE_FORM = 'startDate';
  readonly START_TIME_FORM = 'starTime';
  readonly END_DATE_FORM = 'endDate';
  readonly END_TIME_FORM = 'endTime';
  minStartDate: Date = new Date();
  minEndDate: Date = new Date();
  maxStartDate: Date = new Date();
  maxEndDate: Date = new Date();
  minStartTime = '00:00';
  minEndTime = '00:00';

  applications: Application[] = [];
  readonly selectedApplications = signal<string>('');
  readonly minDurationError = signal<string>('');
  readonly startDateTime = signal<Date | null>(null);
  readonly endDateTime = signal<Date | null>(null);
  readonly isApplicationLoading = signal<boolean>(true);
  readonly applicationLoadingErrorMessage = signal<string>('');
  readonly loaderService = inject(LoaderService);
  readonly localTimeAbbrevation =
    getLocalTimeZoneAbbreviation(
      new Date(new Date()) ?? new Date(),
      Intl.DateTimeFormat().resolvedOptions().timeZone
    ) ?? '';

  createReservationForm: FormGroup = this.fb.group({
    [this.USER_EMAIL_FORM]: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.pattern(
          /^[a-zA-Z0-9-]+-agentspace-demo-user@1987984870407.altostrat.com$/
        ),
      ],
    ],
    [this.START_DATE_FORM]: ['', Validators.required],
    [this.START_TIME_FORM]: ['', Validators.required],
    [this.END_DATE_FORM]: ['', Validators.required],
    [this.END_TIME_FORM]: ['', Validators.required],
  });

  private dialog = inject(MatDialog);
  @Output() createReservationSuccess = new EventEmitter();

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.getAllUserApplications();
    }
    this.listenStartDateChanges();
    this.listenStarTimeChanges();
    this.listenEndDateChanges();
    this.listenEndTimeChanges();
    const today = new Date();
    this.maxStartDate = new Date(today);
    this.maxEndDate = new Date(today);
    this.maxStartDate.setDate(today.getDate() + 30);
    this.maxEndDate.setDate(today.getDate() + 30);
  }

  listenStartDateChanges() {
    this.createReservationForm
      .get(this.START_DATE_FORM)
      ?.valueChanges?.subscribe(() => {
        this.setDateValidations();
      });
  }

  listenStarTimeChanges() {
    this.createReservationForm
      .get(this.START_TIME_FORM)
      ?.valueChanges?.subscribe(() => {
        this.setDateValidations();
      });
  }

  listenEndDateChanges() {
    this.createReservationForm
      .get(this.END_DATE_FORM)
      ?.valueChanges?.subscribe(() => {
        this.setDateValidations();
      });
  }

  listenEndTimeChanges() {
    this.createReservationForm
      .get(this.END_TIME_FORM)
      ?.valueChanges?.subscribe(() => {
        this.setDateValidations();
      });
  }

  setDateValidations() {
    let startDate = new Date();
    let startTime = null;
    let endDate = null;
    let endTime = null;
    const todayDate = new Date();
    let minHours = todayDate.getHours();
    if (this.createReservationForm.get(this.START_DATE_FORM)?.value !== '') {
      startDate = new Date(
        this.createReservationForm.get(this.START_DATE_FORM)?.value
      );
      if (isSameDay(startDate, todayDate)) {
        if (todayDate.getMinutes() !== 0) {
          minHours = todayDate.getHours() + 1;
        }
        this.minStartTime = `${minHours.toString().padStart(2, '0')}:00`;
      } else {
        minHours = 0;
        this.minStartTime = '00:00';
      }
    }

    if (
      this.createReservationForm.get(this.START_TIME_FORM)?.value !== '' &&
      this.createReservationForm.get(this.START_DATE_FORM)?.value !== ''
    ) {
      startTime = new Date(
        this.createReservationForm.get(this.START_TIME_FORM)?.value
      );
      if (isSameDay(startDate, todayDate)) {
        if (startTime.getHours() < minHours) {
          this.createReservationForm.get(this.START_TIME_FORM)?.patchValue('');
        }
      }
    }
    this.minEndDate = startDate;

    if (this.createReservationForm.get(this.END_TIME_FORM)?.value !== '') {
      endTime = new Date(
        this.createReservationForm.get(this.END_TIME_FORM)?.value
      );
    }

    if (this.createReservationForm.get(this.END_DATE_FORM)?.value !== '') {
      endDate = new Date(
        this.createReservationForm.get(this.END_DATE_FORM)?.value
      );
      if (endDate < startDate) {
        this.createReservationForm.get(this.END_DATE_FORM)?.patchValue('');
      }
      if (isSameDay(endDate, startDate)) {
        if (endTime !== null) {
          if (minHours + 2 > endTime.getHours()) {
            this.createReservationForm.get(this.END_TIME_FORM)?.patchValue('');
          }
        }

        if (!isSameDay(todayDate, endDate)) {
          minHours = startTime !== null ? startTime?.getHours() : 0;
        }

        this.minEndTime = `${(minHours + 2).toString().padStart(2, '0')}:00`;
        if (endTime !== null && endTime.getHours() < minHours) {
          this.createReservationForm.get(this.END_TIME_FORM)?.patchValue('');
        }
      } else if (
        isNextDay(startDate, endDate) &&
        startTime !== null &&
        startTime?.getHours() >= 23
      ) {
        this.minEndTime = '01:00';
        if (endTime !== null && endTime.getHours() < 1) {
          this.createReservationForm.get(this.END_TIME_FORM)?.patchValue('');
        }
      } else {
        this.minEndTime = '00:00';
      }
    }
    this.createReservationForm.updateValueAndValidity();

    if (startTime !== null && endTime !== null && endDate !== null) {
      startDate.setHours(startTime.getHours(), 0, 0, 0);
      endDate.setHours(endTime.getHours(), 0, 0, 0);
      console.log(
        'startTime=',
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
      );
      if ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60) < 2) {
        this.minDurationError.set('Minimum two hours gap is required');
      } else {
        this.minDurationError.set('');
      }
    } else {
      this.minDurationError.set('');
    }
    this.setStartDateTime();
    this.setEndDateTime();
  }
  getAllUserApplications() {
    this.isApplicationLoading.set(true);
    this.adminService.fetchAllActiveApplications().subscribe({
      next: (res) => {
        this.applications = res;
        this.applicationLoadingErrorMessage.set('');
        this.isApplicationLoading.set(false);
      },
      error: (error) => {
        this.isApplicationLoading.set(false);
        this.applicationLoadingErrorMessage.set(
          error.error.detail || 'Something went wrong'
        );
      },
    });
  }
  onApplicationSelected(app: Application) {
    this.applications = this.applications.map((element) => {
      if (element.id === app.id) {
        element.isSelected = element.isSelected === true ? false : true;
      }
      return element;
    });
    const selectedApplicationList = this.applications
      .filter((element) => element.isSelected === true)
      .map((element) => element.name);
    if (selectedApplicationList) {
      this.selectedApplications.set(selectedApplicationList.join(', '));
    }
  }

  setStartDateTime() {
    if (
      this.createReservationForm.get(this.START_DATE_FORM)?.value !== '' &&
      this.createReservationForm.get(this.START_TIME_FORM)?.value !== '' &&
      this.minDurationError() === ''
    ) {
      const startDate = new Date(
        this.createReservationForm.get(this.START_DATE_FORM)?.value
      );
      const startTime = new Date(
        this.createReservationForm.get(this.START_TIME_FORM)?.value
      );
      startDate.setHours(startTime.getHours(), 0);
      this.startDateTime.set(startDate);
    } else {
      this.startDateTime.set(null);
    }
  }
  setEndDateTime() {
    if (
      this.createReservationForm.get(this.END_DATE_FORM)?.value !== '' &&
      this.createReservationForm.get(this.END_TIME_FORM)?.value !== '' &&
      this.minDurationError() === ''
    ) {
      const endDate = new Date(
        this.createReservationForm.get(this.END_DATE_FORM)?.value
      );
      const endTime = new Date(
        this.createReservationForm.get(this.END_TIME_FORM)?.value
      );
      endTime.setHours(endTime.getHours(), 0);
      this.endDateTime.set(endDate);
    } else {
      this.endDateTime.set(null);
    }
  }

  onRetryCall() {
    this.getAllUserApplications();
  }
  onConfirmReservation() {
    this.loaderService.show();
    const selectedApplicationIds = this.applications
      .filter((element) => element.isSelected === true)
      .map((element) => element.id);
    const primaryApplicationId = selectedApplicationIds[0];
    let secondaryApplicationIds: number[] = [];
    if (selectedApplicationIds.length > 1) {
      secondaryApplicationIds = selectedApplicationIds.slice(1);
    }
    const startDateTime = new Date(
      this.createReservationForm.get(this.START_DATE_FORM)?.value
    );
    const starTime = new Date(
      this.createReservationForm.get(this.START_TIME_FORM)?.value
    );
    startDateTime.setHours(starTime.getHours(), 0, 0, 0);
    const endDateTime = new Date(
      this.createReservationForm.get(this.END_DATE_FORM)?.value
    );
    const endTime = new Date(
      this.createReservationForm.get(this.END_TIME_FORM)?.value
    );
    endDateTime.setHours(endTime.getHours(), 0, 0, 0);
    const request: AdminCreateReservationRequest = {
      primaryApplicationId: primaryApplicationId,
      secondaryApplicationIds: secondaryApplicationIds,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      candidateUserEmail: this.createReservationForm.get(this.USER_EMAIL_FORM)
        ?.value,
    };
    this.adminService.createReservationByAdmin(request).subscribe({
      next: () => {
        this.showSuccessDialog();
        this.loaderService.hide();
      },
      error: (err) => {
        this.showErrorDialog(err.error.detail || 'Something went wrong');
        this.loaderService.hide();
      },
    });
  }

  showSuccessDialog() {
    const dialogRef = this.dialog.open(SuccessDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        title: 'Success',
        message: 'Reservation created successfully',
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.adminService.refreshReservationsState.update(() => true);
        this.createReservationSuccess.emit();
      }
    });
  }

  showErrorDialog(errorMessage: string) {
    this.dialog.open(ErrorDialog, {
      width: 'auto',
      minWidth: '41.86rem',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        message: errorMessage,
      },
    });
  }
}
