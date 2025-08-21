import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { of } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

import { ReservationTableComponent } from './reservation-table.component';
import {
  BotWithApps,
  Reservation,
} from '../../../core/models/reservation.model';
import { ReservationApiStatus } from '../../../features/landing/landing.enums';
import { ConfirmationDialog } from '../../dialogs/confirmation-dialog/confirmation-dialog';
import { By } from '@angular/platform-browser';

const mockBot1: BotWithApps = {
  id: 1,
  name: 'Automation Bot 01',
  email: 'bot1@example.com',
  applications: [{ id: 1, name: 'App A', isEnabled: true, isSelected: false }],
};
const mockBot2: BotWithApps = {
  id: 2,
  name: 'Data Entry Bot 02',
  email: 'bot2@example.com',
  applications: [{ id: 2, name: 'App B', isEnabled: true, isSelected: false }],
};

const mockReservations: Reservation[] = [
  {
    id: 1,
    userEmail: 'user1@example.com',
    bot: mockBot1,
    applications: [
      { id: 1, name: 'App A', isEnabled: true, isSelected: false },
    ],
    startTime: '2025-08-21T10:00:00Z',
    endTime: '2025-08-21T14:00:00Z',
    status: ReservationApiStatus.ACTIVE,
  },
  {
    id: 2,
    userEmail: 'user2@example.com',
    bot: mockBot2,
    applications: [
      { id: 2, name: 'App B', isEnabled: true, isSelected: false },
    ],
    startTime: '2025-09-01T22:00:00Z',
    endTime: '2025-09-02T02:00:00Z',
    status: ReservationApiStatus.PENDING,
  },
];

const mockMatDialog = {
  open: jest.fn(),
};

describe('ReservationTableComponent', () => {
  let component: ReservationTableComponent;
  let fixture: ComponentFixture<ReservationTableComponent>;
  let dialog: MatDialog;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservationTableComponent],
      providers: [{ provide: MatDialog, useValue: mockMatDialog }],
    }).compileComponents();

    fixture = TestBed.createComponent(ReservationTableComponent);
    component = fixture.componentInstance;
    dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State and Data Handling', () => {
    it('should show the loader initially', () => {
      expect(component.isLoading()).toBe(true);
      const loader = fixture.debugElement.query(
        By.css('app-reservation-table-loader')
      );
      expect(loader).toBeTruthy();
    });

    it('should update dataSource and hide loader when data is passed through ngOnChanges', () => {
      component.data = mockReservations;
      component.ngOnChanges({
        data: new SimpleChange(null, mockReservations, true),
      });
      fixture.detectChanges();

      expect(component.isLoading()).toBe(false);
      expect(component.dataSource.data).toEqual(mockReservations);
      const loader = fixture.debugElement.query(
        By.css('app-reservation-table-loader')
      );
      expect(loader).toBeFalsy();
    });

    it('should show the empty data message when data is empty after loading', () => {
      component.data = [];
      component.ngOnChanges({
        data: new SimpleChange(null, [], true),
      });
      fixture.detectChanges();

      expect(component.isLoading()).toBe(false);
      const emptyMessage = fixture.debugElement.query(
        By.css('.empty-data-message')
      );
      expect(emptyMessage).toBeTruthy();
      expect(emptyMessage.nativeElement.textContent).toContain(
        'No reservations to display.'
      );
    });

    it('should call paginator firstPage method when data changes', () => {
      const mockPaginator = { firstPage: jest.fn() } as any;
      component.dataSource.paginator = mockPaginator;

      component.data = mockReservations;
      component.ngOnChanges({
        data: new SimpleChange([], mockReservations, false),
      });

      expect(mockPaginator.firstPage).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    it('formatDateRange should format a range on the same day correctly', () => {
      const { startTime, endTime } = mockReservations[0];
      const expected = 'August 21, 2025 at 10:00 AM – 2:00 PM';
      expect(component.formatDateRange(startTime, endTime)).toMatch(expected);
    });

    it('formatDateRange should format a range spanning different days correctly', () => {
      const { startTime, endTime } = mockReservations[1];
      const expected =
        'September 1, 2025 at 10:00 PM – September 2, 2025 at 2:00 AM';
      expect(component.formatDateRange(startTime, endTime)).toMatch(expected);
    });

    it('getStatus should return the reservation status', () => {
      expect(component.getStatus(mockReservations[0])).toBe(
        ReservationApiStatus.ACTIVE
      );
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      component.data = mockReservations;
      component.ngOnChanges({
        data: new SimpleChange(null, mockReservations, false),
      });
      fixture.detectChanges();
    });

    it('showConfirmationDialog should open a dialog with correct data', () => {
      const reservation = mockReservations[0];
      mockMatDialog.open.mockReturnValue({
        afterClosed: () => of(false),
      } as MatDialogRef<typeof ConfirmationDialog>);

      component.showConfirmationDialog(reservation);

      expect(mockMatDialog.open).toHaveBeenCalledWith(
        ConfirmationDialog,
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Are You Sure ?',
            applications: 'App A?',
            startDateTime: reservation.startTime,
            endDateTime: reservation.endTime,
          }),
        })
      );
    });

    it('should emit cancelReservation when confirmation dialog result is true', fakeAsync(() => {
      const reservation = mockReservations[0];
      const cancelSpy = jest.spyOn(component.cancelReservation, 'emit');
      mockMatDialog.open.mockReturnValue({
        afterClosed: () => of(true),
      } as MatDialogRef<typeof ConfirmationDialog>);

      component.showConfirmationDialog(reservation);
      tick();

      expect(cancelSpy).toHaveBeenCalledWith(reservation);
    }));

    it('should NOT emit cancelReservation when confirmation dialog result is false', fakeAsync(() => {
      const reservation = mockReservations[0];
      const cancelSpy = jest.spyOn(component.cancelReservation, 'emit');
      mockMatDialog.open.mockReturnValue({
        afterClosed: () => of(false),
      } as MatDialogRef<typeof ConfirmationDialog>);

      component.showConfirmationDialog(reservation);
      tick();

      expect(cancelSpy).not.toHaveBeenCalled();
    }));
  });

  describe('Data Sorting', () => {
    it('should define a custom sortingDataAccessor', () => {
      component.ngAfterViewInit();
      expect(component.dataSource.sortingDataAccessor).toBeDefined();
    });

    it('should correctly access data for sorting by "date"', () => {
      const reservation = mockReservations[0];
      const accessor = component.dataSource.sortingDataAccessor;
      const expectedTime = new Date(reservation.startTime).getTime();
      expect(accessor(reservation, 'date')).toBe(expectedTime);
    });

    it('should correctly access data for sorting by "status"', () => {
      const reservation = mockReservations[1];
      const accessor = component.dataSource.sortingDataAccessor;
      expect(accessor(reservation, 'status')).toBe(
        ReservationApiStatus.PENDING
      );
    });

    it('should correctly access data for default sorting (e.g., by id)', () => {
      const reservation = mockReservations[0];
      const accessor = component.dataSource.sortingDataAccessor;
      expect(accessor(reservation, 'id')).toBe(1);
    });
  });
});
