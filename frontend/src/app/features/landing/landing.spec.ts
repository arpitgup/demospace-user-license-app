import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { LandingPage } from './landing.page';
import { ReservationService } from '../../core/services/reservation.service';
import { UserService } from '../../core/services/user.service';
import { Reservation } from '../../core/models/reservation.model';
import { User } from '../../core/models/user.model';
import { ReservationApiStatus, SearchType } from './landing.enums';
import { MatTabChangeEvent } from '@angular/material/tabs';

const mockUser: User = {
  givenName: 'John',
  familyName: 'Doe',
  email: 'john.doe@example.com',
  fullName: 'John Doe',
};

const mockReservations: Reservation[] = [
  { id: 1, status: ReservationApiStatus.ACTIVE } as Reservation,
  { id: 2, status: ReservationApiStatus.PENDING } as Reservation,
  { id: 3, status: ReservationApiStatus.COMPLETED } as Reservation,
  { id: 4, status: ReservationApiStatus.CANCELLED } as Reservation,
];

const mockUserService = {
  currentUser: signal<User | null>(null),
  fetchCurrentUser: jest.fn(() => of(mockUser)),
};

const mockReservationService = {
  reservations: signal<Reservation[]>([]),
  fetchReservations: jest.fn(() => of(mockReservations)),
  getApplications: jest.fn(() => of([])),
  getConfig: jest.fn(() => of({})),
  cancelReservation: jest.fn(() => of({})),
};

const mockMatDialog = {
  open: jest.fn(),
};

describe('LandingPage', () => {
  let component: LandingPage;
  let fixture: ComponentFixture<LandingPage>;
  let userService: UserService;
  let reservationService: ReservationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUserService.currentUser.set(null);
    mockReservationService.reservations.set([]);

    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: ReservationService, useValue: mockReservationService },
        { provide: MatDialog, useValue: mockMatDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingPage);
    component = fixture.componentInstance;
    userService = TestBed.inject(UserService);
    reservationService = TestBed.inject(ReservationService);
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization and API Calls', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'sessionStorage', {
            value: { getItem: jest.fn(() => 'test@example.com') },
            writable: true,
        });
    });

    it('should call onRefreshData on init if userEmail exists in sessionStorage', () => {
        const refreshSpy = jest.spyOn(component, 'onRefreshData');
        component.ngOnInit();
        expect(refreshSpy).toHaveBeenCalled();
    });

    it('should set loading states and call APIs successfully', fakeAsync(() => {
        component.ngOnInit();
        tick();
        fixture.detectChanges();

        expect(component.isFetchingData).toBe(false);
        expect(component.isError).toBe(false);
        expect(userService.fetchCurrentUser).toHaveBeenCalled();
        expect(reservationService.getApplications).toHaveBeenCalled();
        expect(reservationService.getConfig).toHaveBeenCalled();
    }));

    it('should retry API calls when onRetryCall is triggered', () => {
        const apiSpy = jest.spyOn(component, 'callApplicationConfigApi').mockImplementation(() => {});
        component.isError = true;
        
        component.onRetryCall();

        expect(component.isFetchingData).toBe(true);
        expect(component.isError).toBe(false);
        expect(apiSpy).toHaveBeenCalled();
    });
  });

  describe('User Interactions', () => {
    it('should update selectedSearchType when a card is selected', () => {
        expect(component.selectedSearchType()).toBeNull();
        const searchOption = component.searchOptionCards[0];
        component.onCardSelected(searchOption);
        expect(component.selectedSearchType()).toBe(SearchType.ByDate);
    });

    it('should update showPastReservations signal on change', () => {
        expect(component.showPastReservations()).toBe(false);
        component.onShowPastChange(true);
        expect(component.showPastReservations()).toBe(true);
    });

    it('should update selectedIndex and fetch reservations on tab change', () => {
        const event = { index: 1 } as MatTabChangeEvent;
        component.onTabChange(event);
        expect(component.selectedIndex).toBe(1);
        expect(reservationService.fetchReservations).toHaveBeenCalled();
    });
  });

  describe('Computed Properties', () => {
    it('userFullName should compute the user\'s given name', () => {
        (userService.currentUser as WritableSignal<User | null>).set(mockUser);
        fixture.detectChanges();
        expect(component.userFullName()).toBe('John');
    });

    it('filteredReservations should show active/pending by default', () => {
        (reservationService.reservations as WritableSignal<Reservation[]>).set(mockReservations);
        component.showPastReservations.set(false);
        fixture.detectChanges();
        
        const filtered = component.filteredReservations();
        expect(filtered.length).toBe(2);
        expect(filtered.every(r => r.status === 'ACTIVE' || r.status === 'PENDING')).toBe(true);
    });

    it('filteredReservations should show completed/cancelled when toggled', () => {
        (reservationService.reservations as WritableSignal<Reservation[]>).set(mockReservations);
        component.showPastReservations.set(true);
        fixture.detectChanges();

        const filtered = component.filteredReservations();
        expect(filtered.length).toBe(2);
        expect(filtered.every(r => r.status === 'COMPLETED' || r.status === 'CANCELLED')).toBe(true);
    });
  });

  describe('Dialogs and Reservation Cancellation', () => {
    it('should call cancelReservation service and show success dialog', fakeAsync(() => {
        const reservationToCancel = mockReservations[0];
        (reservationService.cancelReservation as jest.Mock).mockReturnValue(of({}));
        
        const dialogSpy = mockMatDialog.open.mockReturnValue({
            afterClosed: () => of(true)
        });

        component.handleCancelReservation(reservationToCancel);
        tick();

        expect(reservationService.cancelReservation).toHaveBeenCalledWith(reservationToCancel.id);
        expect(dialogSpy).toHaveBeenCalled();
    }));

    it('should handle cancellation error', () => {
        const error = new Error('Failed to cancel');
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        (reservationService.cancelReservation as jest.Mock).mockReturnValue(throwError(() => error));

        component.handleCancelReservation(mockReservations[0]);

        expect(consoleSpy).toHaveBeenCalledWith('Failed to cancel reservation:', error);
        consoleSpy.mockRestore();
    });
  });
});
