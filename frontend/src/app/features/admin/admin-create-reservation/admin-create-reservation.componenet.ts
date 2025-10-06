import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
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
import { ReservationService } from '../../../core/services/reservation.service';

import { Application } from '../../../core/models/application.model';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { isSameDay } from '../../search-by-date/search-by-date.utils';
import { getLocalTimeZoneAbbreviation } from '../../../../utilities/utils';
import { SearchByApplicationLoader } from '../../../loaders/search-by-application-loader/search-by-application-loader';
import { AdminCreateReservationLoaderComponent } from '../../../loaders/admin-create-reservation-loader/admin-create-reservation-loader.component';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';

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
  private reservationService = inject(ReservationService);
  private cdr = inject(ChangeDetectorRef);
  readonly USER_NAME_FORM = 'userName';
  readonly USER_EMAIL_FORM = 'userEmail';
  readonly START_DATE_FORM = 'startDate';
  readonly START_TIME_FORM = 'starTime';
  readonly END_DATE_FORM = 'endDate';
  readonly END_TIME_FORM = 'endTime';
  minStartDate: Date = new Date();
  minEndDate: Date = new Date();
  minStartTime = '00:00';
  minEndTime = '00:00';

  applications: Application[] = [];
  readonly selectedApplications = signal<String>('');
  readonly minDurationError = signal<String>('');
  readonly startDateTime = signal<Date | null>(null);
  readonly endDateTime = signal<Date | null>(null);
  readonly isApplicationLoading = signal<boolean>(true);
  readonly applicationLoadingErrorMessage = signal<string>('');
  readonly localTimeAbbrevation =
    getLocalTimeZoneAbbreviation(
      new Date(new Date()) ?? new Date(),
      Intl.DateTimeFormat().resolvedOptions().timeZone
    ) ?? '';

  createReservationForm: FormGroup = this.fb.group({
    [this.USER_NAME_FORM]: ['', Validators.required],
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

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.getAllUserApplications();
    }
    this.listenStartDateChanges();
    this.listenStarTimeChanges();
    this.listenEndDateChanges();
    this.listenEndTimeChanges();
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
        this.minEndTime = `${(minHours + 2).toString().padStart(2, '0')}:00`;
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
    this.reservationService.getApplications().subscribe({
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
}
