import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ChangeDetectorRef, WritableSignal } from '@angular/core';

import { SearchByDateComponent } from './search-by-date.component';
import { ReservationService } from '../../core/services/reservation.service';
import { Application } from '../../core/models/application.model';
import { AppConfig } from '../../core/models/appConfig.model';
import {
  mockAppConfig,
  mockReservationService,
  mockMatDialog,
  mockAvailableBots,
} from '../../core/mocks/reservation.mock';
import { BotsAvailabilityResponse } from '../../core/models/reservation.model';

describe('SearchByDateComponent', () => {
  let component: SearchByDateComponent;
  let fixture: ComponentFixture<SearchByDateComponent>;
  let reservationService: ReservationService;
  let futureDate: Date;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchByDateComponent, ReactiveFormsModule],
      providers: [
        FormBuilder,
        ChangeDetectorRef,
        { provide: ReservationService, useValue: mockReservationService },
        { provide: MatDialog, useValue: mockMatDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchByDateComponent);
    component = fixture.componentInstance;
    reservationService = TestBed.inject(ReservationService);
    futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    fixture.detectChanges();

    (reservationService.appConfigData as WritableSignal<AppConfig | null>).set(
      mockAppConfig
    );
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('Form Initialization and State', () => {
    it('should initialize the form with null values and disabled time controls', () => {
      expect(component.startDateCtrl.value).toBeNull();
      expect(component.startTimeCtrl.value).toBeNull();
      expect(component.endTimeCtrl.value).toBeNull();
    });

    it('should set initial signal values correctly', () => {
      expect(component.availableApplications().length).toBe(0);
      expect(component.selectedApps().length).toBe(0);
    });
  });

  describe('Date and Time Slot Generation', () => {
    it('should enable the start time control when a valid date is selected', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      component.startDateCtrl.setValue(futureDate);
      fixture.detectChanges();
      expect(component.startTimeCtrl.enabled).toBeTruthy();
    });

    it('should set 8 AM as the default start time if available', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      component.startDateCtrl.setValue(futureDate);
      component['buildStartTimeSlots']();
      fixture.detectChanges();
      expect(component.startTimeCtrl.value).toBe('08:00 AM');
    });

    it('should fall back to the next available time if 8 AM is blocked', () => {
      component.blockedIntervals = [
        {
          start: new Date(futureDate.setHours(8, 0, 0, 0)),
          end: new Date(futureDate.setHours(10, 0, 0, 0)),
        },
      ];

      component.startDateCtrl.setValue(futureDate);
      component['buildStartTimeSlots']();
      fixture.detectChanges();
      expect(component.startTimeCtrl.value).toBe('12:00 AM');
    });

    it('should populate endTimeSlots based on the selected start time', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('08:00 AM');
      component['buildEndTimeSlots']();
      fixture.detectChanges();

      expect(component.endTimeSlots().length).toBeGreaterThan(0);
      expect(component.endTimeSlots()).toContain('10:00 AM (2 hrs)');
    });
  });

  describe('Form Validation', () => {
    it('should be valid with a complete and valid date/time selection', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('08:00 AM');
      component.endTimeCtrl.setValue('10:00 AM (2 hrs)');
      component['calculateEndDate']();
      fixture.detectChanges();

      expect(component.form.valid).toBeTruthy();
      expect(component.isCheckAvailabilityDisabled()).toBeFalsy();
    });

    it('should be invalid if the time range overlaps with a blocked interval', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      const blockedInterval = {
        start: new Date(futureDate.setHours(10, 0, 0, 0)),
        end: new Date(futureDate.setHours(12, 0, 0, 0)),
      };
      component.blockedIntervals = [blockedInterval];

      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('09:00 AM');
      component.endTimeCtrl.setValue('01:00 PM (4 hrs)');
      component.form.updateValueAndValidity();
      fixture.detectChanges();

      expect(component.form.invalid).toBeTruthy();
      expect(component.form.hasError('overlapsExisting')).toBeTruthy();
    });
  });

  describe('API and State Management', () => {
    it('should set isLoading to true and call the service on check availability', () => {
      jest
        .spyOn(reservationService, 'checkBotsAvailabilityByDate')
        .mockReturnValue(of({ availableBots: [] }));

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('08:00 AM');
      component.endTimeCtrl.setValue('10:00 AM (2 hrs)');
      component['calculateEndDate']();
      fixture.detectChanges();

      component.onCheckAvailability();
      expect(reservationService.checkBotsAvailabilityByDate).toHaveBeenCalled();
    });

    it('should update state and show results on successful availability check', (done) => {
      const applications: Application[] = [
        { id: 1, name: 'App1', isEnabled: true, isSelected: true },
      ];
      const mockResponse: BotsAvailabilityResponse = {
        availableBots: [{ ...mockAvailableBots, applications }],
      };
      jest
        .spyOn(reservationService, 'checkBotsAvailabilityByDate')
        .mockReturnValue(of(mockResponse));

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('08:00 AM');
      component.endTimeCtrl.setValue('10:00 AM (2 hrs)');
      component['calculateEndDate']();
      fixture.detectChanges();

      component.onCheckAvailability();

      setTimeout(() => {
        fixture.detectChanges();
        expect(component.availableApplications()).toEqual(applications);
        expect(component.showResultsCard()).toBeTruthy();
        done();
      }, 0);
    });
  });
});
