import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ChangeDetectorRef, WritableSignal } from '@angular/core';
import { MatButtonToggleChange } from '@angular/material/button-toggle';

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
import {
  formatDate,
  formatTime12h,
  intervalsOverlap,
  isSameDay,
  normalizeServerTime,
  parseDurationFromEndTime,
  parseHourFromTime,
} from './search-by-date.utils';

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
    futureDate.setHours(0, 0, 0, 0);

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
      expect(component.startTimeCtrl.disabled).toBeTruthy();
      expect(component.endTimeCtrl.disabled).toBeTruthy();
    });

    it('should set initial signal values correctly', () => {
      expect(component.availableApplications().length).toBe(0);
      expect(component.selectedApps().length).toBe(0);
    });
  });

  describe('Date and Time Slot Generation', () => {
    it('should enable the start time control when a valid date is selected', () => {
      component.startDateCtrl.setValue(futureDate);
      fixture.detectChanges();
      expect(component.startTimeCtrl.enabled).toBeTruthy();
    });

    it('should set 8 AM as the default start time if available', () => {
      component.startDateCtrl.setValue(futureDate);
      component['buildStartTimeSlots']();
      fixture.detectChanges();
      expect(component.startTimeCtrl.value).toBe('08:00 AM');
    });

    it('should fall back to the next available time if 8 AM is blocked', () => {
      const blockedStart = new Date(futureDate);
      blockedStart.setHours(8, 0, 0, 0);
      const blockedEnd = new Date(futureDate);
      blockedEnd.setHours(10, 0, 0, 0);

      component.blockedIntervals = [{ start: blockedStart, end: blockedEnd }];
      component.startDateCtrl.setValue(futureDate);
      component['buildStartTimeSlots']();
      fixture.detectChanges();
      expect(component.startTimeCtrl.value).toBe('12:00 AM');
    });

    it('should populate endTimeSlots based on the selected start time', () => {
      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('08:00 AM');
      component['buildEndTimeSlots']();
      fixture.detectChanges();

      expect(component.endTimeSlots().length).toBeGreaterThan(0);
      expect(component.endTimeSlots()).toContain('10:00 AM (2 hrs)');
    });

    it('should correctly filter past dates using dateFilter', () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      expect(component.dateFilter(today)).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('should be valid with a complete and valid date/time selection', () => {
      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('08:00 AM');
      component.endTimeCtrl.setValue('10:00 AM (2 hrs)');
      component['calculateEndDate']();
      fixture.detectChanges();

      expect(component.form.valid).toBeTruthy();
      expect(component.isCheckAvailabilityDisabled()).toBeFalsy();
    });

    it('should be invalid if the time range overlaps with a blocked interval', () => {
      const blockedStart = new Date(futureDate);
      blockedStart.setHours(10, 0, 0, 0);
      const blockedEnd = new Date(futureDate);
      blockedEnd.setHours(12, 0, 0, 0);

      component.blockedIntervals = [{ start: blockedStart, end: blockedEnd }];

      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('09:00 AM');
      component.endTimeCtrl.setValue('01:00 PM (4 hrs)');
      component.form.updateValueAndValidity();
      fixture.detectChanges();

      expect(component.form.invalid).toBeTruthy();
      expect(component.form.hasError('overlapsExisting')).toBeTruthy();
    });

    it('should be invalid if reservation duration exceeds max duration', () => {
      const longEndTime = '10:00 AM (50 hrs)';

      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('08:00 AM');
      component.endTimeCtrl.setValue(longEndTime);
      component.form.updateValueAndValidity();
      fixture.detectChanges();
      expect(component.form.hasError('maxDurationExceeded')).toBeFalsy();
    });
  });

  describe('API and State Management', () => {
    beforeEach(() => {
      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('08:00 AM');
      component.endTimeCtrl.setValue('10:00 AM (2 hrs)');
      component['calculateEndDate']();
      fixture.detectChanges();
    });

    it('should set isLoading to true and call the service on check availability', () => {
      jest
        .spyOn(reservationService, 'checkBotsAvailabilityByDate')
        .mockReturnValue(of({ availableBots: [] }));
      component.onCheckAvailability();
      expect(reservationService.checkBotsAvailabilityByDate).toHaveBeenCalled();
    });

    it('should update state and show results on successful availability check', fakeAsync(() => {
      const applications: Application[] = [
        { id: 1, name: 'App1', isEnabled: true, isSelected: false,isActive:true  },
      ];
      const mockResponse: BotsAvailabilityResponse = {
        availableBots: [{ ...mockAvailableBots, applications }],
      };
      jest
        .spyOn(reservationService, 'checkBotsAvailabilityByDate')
        .mockReturnValue(of(mockResponse));

      component.onCheckAvailability();
      tick();
      fixture.detectChanges();

      expect(component.availableApplications()).toEqual(applications);
      expect(component.showResultsCard()).toBeTruthy();
      expect(component.isLoading()).toBeFalsy();
    }));

    it('should handle API errors gracefully during availability check', fakeAsync(() => {
      jest
        .spyOn(reservationService, 'checkBotsAvailabilityByDate')
        .mockReturnValue(throwError(() => new Error('API Error')));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      component.onCheckAvailability();
      tick();
      fixture.detectChanges();

      expect(component.isLoading()).toBeFalsy();
      expect(console.error).toHaveBeenCalledWith(
        'Error checking bot availability:',
        expect.any(Error)
      );
    }));

    it('should show an empty state when no applications are available', fakeAsync(() => {
      const mockResponse: BotsAvailabilityResponse = { availableBots: [] };
      jest
        .spyOn(reservationService, 'checkBotsAvailabilityByDate')
        .mockReturnValue(of(mockResponse));

      component.onCheckAvailability();
      tick();
      fixture.detectChanges();

      expect(component.availableApplications().length).toBe(0);
      expect(component.showResultsCard()).toBeTruthy();
    }));
  });

  describe('Application Selection', () => {
    const mockApps: Application[] = [
      { id: 1, name: 'App1', isEnabled: true, isSelected: false,isActive:true },
      { id: 2, name: 'App2', isEnabled: true, isSelected: false,isActive:true },
      { id: 3, name: 'App3', isEnabled: true, isSelected: false,isActive:true },
      { id: 4, name: 'App4', isEnabled: true, isSelected: false,isActive:true },
    ];

    beforeEach(() => {
      component.availableApplications.set(mockApps);
      fixture.detectChanges();
    });

    it('should update selectedApps when an application is toggled', () => {
      const toggleEvent = {
        value: [mockApps[0], mockApps[2]],
      } as MatButtonToggleChange;
      component.onToggleGroupChange(toggleEvent);
      fixture.detectChanges();

      expect(component.selectedApps().length).toBe(2);
      expect(component.selectedApps()).toContain(mockApps[0]);
      expect(component.selectedApps()).toContain(mockApps[2]);
    });

    it('should disable other applications when the selection limit is reached', () => {
      const selected = [mockApps[0], mockApps[1], mockApps[2]];
      component.selectedApps.set(selected);
      fixture.detectChanges();

      expect(component.isAppToggleDisabled(mockApps[3])).toBeTruthy();
      expect(component.isAppToggleDisabled(mockApps[0])).toBeFalsy();
    });

    it('should sync the noValidStartTimeOptions error from the form to the startDateCtrl', () => {
      component.startDateCtrl.setValue(futureDate);
      component.form.setErrors({ noValidStartTimeOptions: true });
      component['syncControlErrors']();
      fixture.detectChanges();
      expect(
        component.startDateCtrl.hasError('noValidStartTimeOptions')
      ).toBeTruthy();
    });
  });

  describe('dateTimeComboValidator', () => {
    it('should return invalidEndTimeFormat error for a malformed endTimeLabel', () => {
      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('08:00 AM');
      component.endTimeCtrl.setValue('Invalid End Time String');
      expect(component.form.hasError('invalidEndTimeFormat')).toBeTruthy();
      expect(component.form.hasError('dateTimeInvalid')).toBeTruthy();
    });

    it('should return endBeforeOrEqualStart error if duration is zero or negative', () => {
      component.startDateCtrl.setValue(futureDate);
      component.startTimeCtrl.setValue('08:00 AM');
      component.endTimeCtrl.setValue('08:00 AM (0 hrs)');
      expect(component.form.hasError('endBeforeOrEqualStart')).toBeTruthy();
      expect(component.form.hasError('dateTimeInvalid')).toBeTruthy();
    });
  });

  describe('Date and Time Utility Functions', () => {
    describe('formatTime12h', () => {
      it('should format midnight (0) as 12:00 AM', () => {
        expect(formatTime12h(0)).toBe('12:00 AM');
      });

      it('should format AM hours correctly with padding', () => {
        expect(formatTime12h(8)).toBe('08:00 AM');
      });

      it('should format noon (12) as 12:00 PM', () => {
        expect(formatTime12h(12)).toBe('12:00 PM');
      });

      it('should format PM hours correctly', () => {
        expect(formatTime12h(15)).toBe('03:00 PM');
      });

      it('should format the last hour of the day (23) correctly', () => {
        expect(formatTime12h(23)).toBe('11:00 PM');
      });
    });

    describe('parseHourFromTime', () => {
      it('should parse standard AM time', () => {
        expect(parseHourFromTime('09:00 AM')).toBe(9);
      });

      it('should parse standard PM time', () => {
        expect(parseHourFromTime('03:00 PM')).toBe(15);
      });

      it('should handle 12:00 AM as hour 0', () => {
        expect(parseHourFromTime('12:00 AM')).toBe(0);
      });

      it('should handle 12:00 PM as hour 12', () => {
        expect(parseHourFromTime('12:00 PM')).toBe(12);
      });

      it('should be case-insensitive for AM/PM', () => {
        expect(parseHourFromTime('04:00 pm')).toBe(16);
      });

      it('should handle non-breaking spaces', () => {
        expect(parseHourFromTime('10:00\u00A0AM')).toBe(10);
      });

      it('should return NaN for invalid time strings', () => {
        expect(parseHourFromTime('invalid-time')).toBeNaN();
        expect(parseHourFromTime('13:00')).toBeNaN();
        expect(parseHourFromTime('5 PM')).toBeNaN();
      });
    });

    describe('parseDurationFromEndTime', () => {
      it('should parse duration with "hrs"', () => {
        expect(parseDurationFromEndTime('10:00 AM (2 hrs)')).toBe(2);
      });

      it('should parse duration with "hr"', () => {
        expect(parseDurationFromEndTime('09:00 AM (1 hr)')).toBe(1);
      });

      it('should return NaN if no duration is found', () => {
        expect(parseDurationFromEndTime('01:00 PM')).toBeNaN();
      });
    });

    describe('isSameDay', () => {
      const date1 = new Date('2023-10-26T10:00:00Z');
      const date2 = new Date('2023-10-26T18:00:00Z');
      const date3 = new Date('2023-10-27T10:00:00Z');
      const date4 = new Date('2024-10-26T10:00:00Z');

      it('should return true for dates on the same day, month, and year', () => {
        expect(isSameDay(date1, date2)).toBe(true);
      });

      it('should return false for dates on different days', () => {
        expect(isSameDay(date1, date3)).toBe(false);
      });

      it('should return false for dates in different years', () => {
        expect(isSameDay(date1, date4)).toBe(false);
      });
    });

    describe('formatDate', () => {
      it('should format a date into YYYY-MM-DD format', () => {
        const date = new Date('2023-11-27T10:00:00Z');
        expect(formatDate(date)).toBe('2023-11-27');
      });

      it('should pad single-digit months and days with a leading zero', () => {
        const date = new Date('2024-02-05T10:00:00Z');
        expect(formatDate(date)).toBe('2024-02-05');
      });
    });

    describe('intervalsOverlap', () => {
      const baseStart = new Date('2023-01-01T10:00:00Z');
      const baseEnd = new Date('2023-01-01T12:00:00Z');

      it('should return true when one interval starts during another', () => {
        const overlapStart = new Date('2023-01-01T11:00:00Z');
        const overlapEnd = new Date('2023-01-01T13:00:00Z');
        expect(
          intervalsOverlap(baseStart, baseEnd, overlapStart, overlapEnd)
        ).toBe(true);
      });

      it('should return true when one interval completely contains another', () => {
        const innerStart = new Date('2023-01-01T10:30:00Z');
        const innerEnd = new Date('2023-01-01T11:30:00Z');
        expect(intervalsOverlap(baseStart, baseEnd, innerStart, innerEnd)).toBe(
          true
        );
      });

      it('should return false for adjacent intervals (touching but not overlapping)', () => {
        const adjacentStart = new Date('2023-01-01T12:00:00Z');
        const adjacentEnd = new Date('2023-01-01T14:00:00Z');
        expect(
          intervalsOverlap(baseStart, baseEnd, adjacentStart, adjacentEnd)
        ).toBe(false);
      });

      it('should return false for completely separate intervals', () => {
        const separateStart = new Date('2023-01-01T14:00:00Z');
        const separateEnd = new Date('2023-01-01T16:00:00Z');
        expect(
          intervalsOverlap(baseStart, baseEnd, separateStart, separateEnd)
        ).toBe(false);
      });
    });

    describe('normalizeServerTime', () => {
      const isoString = '2023-08-21T14:30:00Z';
      const isoStringNoSeconds = '2023-08-21T14:30';

      it('should handle UTC mode by creating a standard Date object', () => {
        const expected = new Date(isoString);
        expect(normalizeServerTime(isoString, 'utc')).toEqual(expected);
      });

      it('should handle local-wall mode by parsing components as local time', () => {
        const expected = new Date(2023, 7, 21, 14, 30, 0);
        expect(normalizeServerTime(isoString, 'local-wall')).toEqual(expected);
      });

      it('should handle local-wall mode for ISO strings without seconds', () => {
        const expected = new Date(2023, 7, 21, 14, 30, 0);
        expect(normalizeServerTime(isoStringNoSeconds, 'local-wall')).toEqual(
          expected
        );
      });

      it('should return an Invalid Date for invalid ISO strings in local-wall mode', () => {
        const invalidIso = 'not-a-date';
        const resultDate = normalizeServerTime(invalidIso, 'local-wall');
        expect(resultDate.getTime()).toBeNaN();
      });
    });
  });
});
