import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { SearchApplicationComponent } from './search-application';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ChangeDetectorRef, WritableSignal } from '@angular/core';
import { ReservationService } from '../../core/services/reservation.service';
import {
  application$,
  makeReservationMock,
  mockAppConfig,
  mockApplication,
  mockCheckAvailaibilityByApplication,
  mockReservationService,
  mockSearchApplicationReservation,
} from '../../core/mocks/reservation.mock';
import {
  MatDialog,
  MatDialogModule,
} from '@angular/material/dialog';
import { AppConfig } from '../../core/models/appConfig.model';
import { SearchByApplicationLoader } from '../../loaders/search-by-application-loader/search-by-application-loader';
import { AsyncPipe, DatePipe } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { Reservation } from '../../core/models/reservation.model';
import { AvalaibilityByApplication } from '../../core/models/availabilityByApplication.model';
import { ConfirmationDialog } from '../../shared/dialogs/confirmation-dialog/confirmation-dialog';
import { SuccessDialog } from '../../shared/dialogs/success-dialog/success-dialog';
import { of } from 'rxjs';

describe('SearchApplicationComponent', () => {
  let component: SearchApplicationComponent;
  let fixture: ComponentFixture<SearchApplicationComponent>;
  let reservationService: ReservationService;
  let compiled: HTMLElement;
  const todayDate = new Date();
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SearchApplicationComponent,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatIconModule,
        MatTimepickerModule,
        MatGridListModule,
        MatDividerModule,
        AsyncPipe,
        DatePipe,
        SearchByApplicationLoader,
        MatDialogModule,
        ConfirmationDialog,
      ],
      providers: [
        FormBuilder,
        ChangeDetectorRef,
        { provide: ReservationService, useValue: mockReservationService },
        { provide: MatDialog, useValue: mockMatDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchApplicationComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement as HTMLElement;
    reservationService = TestBed.inject(ReservationService);
    fixture.detectChanges();
    (reservationService.appConfigData as WritableSignal<AppConfig | null>).set(
      mockAppConfig
    );
    (
      reservationService.reservations as WritableSignal<Reservation[] | null>
    ).set(mockSearchApplicationReservation);
    reservationService.applications$ = application$;
    fixture.detectChanges();
    todayDate.setFullYear(2025);
    todayDate.setMonth(7);
    todayDate.setDate(21);
    component.minDate = new Date(todayDate);
    component.minDate.setDate(todayDate.getDate() + 1);
    component.maxDate = new Date(todayDate);
    component.maxDate.setDate(
      todayDate.getDate() + component.MAX_CALENDAR_DAYS
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have a tile and subtitle', () => {
    const h1 = compiled.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1?.textContent).toContain('Select Application & Date');
  });

  it('Check mat label for all formfields', () => {
    const labels = fixture.nativeElement.querySelectorAll('mat-label');
    expect(labels.length).toBe(4);

    const labelTexts = (Array.from(labels) as HTMLElement[]).map(
      (label: HTMLElement) => label.textContent.trim()
    );

    expect(labelTexts).toEqual([
      'Primary Application',
      'Start Date',
      'Start Time',
      'Select Duration',
    ]);

    const subTitle = compiled.querySelector('.sub-title');
    expect(subTitle).toBeTruthy();
    expect(subTitle?.textContent).toContain('Select Application');
  });

  it('applications rendered elements', () => {
    const primaryApplication = fixture.nativeElement.querySelector(
      '#primary-application'
    );
    expect(primaryApplication).toBeTruthy();
    primaryApplication.click();
    const options = document.querySelectorAll('mat-option');
    const valueExists = Array.from(options).some(
      (option) => option.textContent.trim() === 'Box'
    );
    expect(valueExists).toBe(true);
    primaryApplication.click();
  });

  describe('Form Initialization and State', () => {
    it('should initialize the form with 4 controls', () => {
      expect(component.applicationForm).toBeDefined();
      expect(
        component.applicationForm.get(component.PRIMARY_APPLICATION_FORM)?.value
      ).toBe('');
      expect(
        component.applicationForm.get(component.START_DATE_FORM)?.value
      ).toBe('');
      expect(
        component.applicationForm.get(component.START_TIME_FORM)?.value
      ).toBe('');
      expect(
        component.applicationForm.get(component.SELECTED_DURATION_FORM)?.value
      ).toBe('');
    });
  });

  describe('Date Picker and Time Picker Filters', () => {
    it('Check Date and Time Picker', () => {
      const datePicker = fixture.nativeElement.querySelector('#date-picker');
      expect(datePicker).toBeTruthy();
      const timePicker = fixture.nativeElement.querySelector('#time-picker');
      expect(timePicker).toBeTruthy();
      datePicker.click();
      fixture.detectChanges();
    });
    it('Check enable and disable dates in date picker', () => {
      const futureMaxDate = new Date(todayDate);
      futureMaxDate.setDate(
        futureMaxDate.getDate() + component.MAX_CALENDAR_DAYS
      );
      expect(component.maxDate.getDate()).toBe(futureMaxDate.getDate());
      expect(component.maxDate.getMonth()).toBe(futureMaxDate.getMonth());
      const minDate = new Date(todayDate);
      minDate.setDate(minDate.getDate() + 1);
      expect(component.minDate.getDate()).toBe(minDate.getDate());
      expect(component.minDate.getMonth()).toBe(minDate.getMonth());
      const disableDate = new Date(todayDate);
      disableDate.setDate(disableDate.getDate() + 8);
      expect(component.dateFilter(disableDate)).toBe(false);
      const enableDate = new Date(todayDate);
      enableDate.setDate(enableDate.getDate() + 4);
      expect(component.dateFilter(enableDate)).toBe(true);
    });
    it('Check Time slots', () => {
      const futureDate = new Date(todayDate);
      futureDate.setDate(futureDate.getDate() + 10);
      component.applicationForm
        ?.get(component.START_DATE_FORM)
        ?.patchValue(futureDate);
      fixture.detectChanges();
      const expected = new Date(futureDate);
      expected.setHours(8, 0, 0, 0);
      expect(
        component.applicationForm?.get(component.START_TIME_FORM)?.value
      ).toStrictEqual(expected);
      const timePicker = fixture.nativeElement.querySelector('#time-picker');

      timePicker.click();
      const options = document.querySelectorAll('mat-option');
      const valueExists = Array.from(options).some((option) => {
        return option.textContent.trim().includes('11:00 AM');
      });

      expect(valueExists).toBe(true);
      timePicker.click();
    });

    it('Check Duration Drop-down', () => {
      const todayDate = new Date();
      const futureDate = new Date();
      futureDate.setDate(todayDate.getDate() + 10);
      component.applicationForm
        ?.get(component.START_DATE_FORM)
        ?.patchValue(futureDate);
      fixture.detectChanges();
      const durationPicker =
        fixture.nativeElement.querySelector('#duration-picker');
      durationPicker.click();
      const options = document.querySelectorAll('mat-option');
      const valueExists = Array.from(options).some((option) => {
        return option.textContent.trim().includes('4 Hours');
      });
      expect(valueExists).toBe(true);
      durationPicker.click();
    });
  });

  describe('Form Validation And Check  Availaibility Api', () => {
    beforeEach(() => {
      component.applicationForm
        ?.get(component.PRIMARY_APPLICATION_FORM)
        ?.patchValue(mockApplication[0]);
      const todayDate = new Date();
      const futureDate = new Date();
      futureDate.setDate(todayDate.getDate() + 10);
      component.applicationForm
        ?.get(component.START_DATE_FORM)
        ?.patchValue(futureDate);
      const startDateTime = new Date('2025-09-01T08:00:00.000Z');
      component.applicationForm
        ?.get(component.START_TIME_FORM)
        ?.patchValue(startDateTime);
      component.applicationForm
        ?.get(component.SELECTED_DURATION_FORM)
        ?.patchValue(component.durations[0]);
      fixture.detectChanges();
    });
    it('Form Validity', () => {
      expect(component.applicationForm.valid).toBeTruthy();
    });

    it('Check loading components', () => {
      const btnCheckAvailability = fixture.nativeElement.querySelector(
        '#btn-check-availability'
      );
      btnCheckAvailability.click();
      expect(component.isCheckAvailabilityLoading).toBe(true);
      expect(component.isCheckAvailableDisabled).toBe(true);
      fixture.detectChanges();
      const cardLoader = fixture.nativeElement.querySelector('#card-loader');
      expect(cardLoader).toBeTruthy();
    });

    it('Check Availability Api', fakeAsync(() => {
      const spySaveData = jest.spyOn(component, 'callMakeReservation');
      mockDialogRef.afterClosed.mockReturnValue(of(true));
      jest
        .spyOn(reservationService, 'callMakeReservation')
        .mockReturnValue(of(makeReservationMock));
      fixture.detectChanges();
      const mockResponse: AvalaibilityByApplication =
        mockCheckAvailaibilityByApplication;
      jest
        .spyOn(reservationService, 'checkAvailabilityByApplication')
        .mockReturnValue(of(mockResponse));
      tick();
      fixture.detectChanges();
      const btnCheckAvailability = fixture.nativeElement.querySelector(
        '#btn-check-availability'
      );
      btnCheckAvailability.click();
      expect(component.isCheckAvailabilityLoading).toBe(false);
      component.onApplicationClicked(component.secondaryApplications[0]);
      expect(component.secondaryApplications[0].isSelected).toBe(true);
      const btnConfirmReservation = fixture.nativeElement.querySelector(
        '#btn-confirm-reservation'
      );
      btnConfirmReservation.click();
      expect(mockMatDialog.open).toHaveBeenCalledWith(ConfirmationDialog, {
        data: {
          applications: 'Box, Sharepoint?',
          cancelText: 'Cancel',
          confirmText: 'Confirm',
          endDateTime: '2025-09-01T10:00:00Z',
          licenseTitle: 'The requested license(s) will be available on',
          message: 'Do you want to confirm the booking for',
          startDateTime: '2025-09-01T08:00:00Z',
          title: 'Are You Sure ?',
        },
        disableClose: true,
        maxHeight: 'none',
        maxWidth: 'none',
        minHeight: 'none',
        minWidth: 'none',
        width: 'auto',
      });
      expect(spySaveData).toHaveBeenCalled();
      expect(mockMatDialog.open).toHaveBeenCalledWith(SuccessDialog, {
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
    }));
  });
});

const mockDialogRef = {
  afterClosed: jest.fn(() => of(true)), // Mock afterClosed to return a true value
};

// Mock for MatDialog service
const mockMatDialog = {
  open: jest.fn(() => mockDialogRef), // Mock open to return our mock ref
};
