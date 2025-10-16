import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ReservationService } from './reservation.service';
import { LoaderService } from './loading.service';
import { environment } from '../../../environments/environment';
import { Application } from '../models/application.model';
import {
  BotWithApps,
  NewReservation,
  Reservation,
} from '../models/reservation.model';
import { AppConfig } from '../models/appConfig.model';
import { MakeReservationRequest } from '../models/make-reservation-request.model';
import { AvailabilityByApplicationRequest } from '../models/availability-by-application-request.model';
import { AvalaibilityByApplication } from '../models/availability-by-application.model';

describe('ReservationService', () => {
  let service: ReservationService;
  let httpMock: HttpTestingController;
  let loaderService: LoaderService;

  const apiUrl = environment.apiUrl;

  const mockApplications: Application[] = [
    { id: 1, name: 'App 1', isEnabled: true, isSelected: false, isActive: true },
    { id: 2, name: 'App 2', isEnabled: true, isSelected: false, isActive: false },
  ];

  const mockReservations: Reservation[] = [
    {
      id: 1,
      userEmail: 'test@test.com',
      bot: { id: 101, name: 'Bot A', email: 'botA@test.com' },
      applications: [mockApplications[0]],
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      status: 'ACTIVE',
    },
  ];

  const mockBotWithApps: BotWithApps[] = [
    {
      id: 101,
      name: 'Bot 1',
      email: 'bot1@test.com',
      applications: mockApplications,
    },
  ];

  const mockAppConfig: AppConfig = {
    maxReservationApplications: 3,
    maxCalendarDays: 90,
    rollingWindowHours: 24,
    reservationLeadDays: 1,
    unavailableReservationDays: 0,
    maxSlotsToFind: 5,
    reservationCoolOffHours: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ReservationService,
        {
          provide: LoaderService,
          useValue: {
            show: jest.fn(),
            hide: jest.fn(),
          },
        },
      ],
    });

    service = TestBed.inject(ReservationService);
    httpMock = TestBed.inject(HttpTestingController);
    loaderService = TestBed.inject(LoaderService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('API and Data Fetching Methods', () => {
    it('checkAvailabilityByDate should POST to the correct endpoint', () => {
      const payload = { startTime: 'start', endTime: 'end' };
      service.checkAvailabilityByDate(payload).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/availability/by-date`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ applications: mockApplications });
    });

    it('checkBotsAvailabilityByDate should POST to the correct V2 endpoint', () => {
      const payload = { startTime: 'start', endTime: 'end' };
      service.checkBotsAvailabilityByDate(payload).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/availability/by-date/v2`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ availableBots: mockBotWithApps });
    });

    it('getApplications should GET and update the applications$ stream', () => {
      service.getApplications().subscribe();

      const req = httpMock.expectOne(`${apiUrl}/applications`);
      expect(req.request.method).toBe('GET');
      req.flush(mockApplications);

      service.applications$.subscribe((apps) => {
        expect(apps).toEqual(mockApplications);
      });
    });

    it('checkAvailabilityByApplication should POST to the correct endpoint', () => {
      // UPDATED to match new interface
      const payload: AvailabilityByApplicationRequest = {
        applicationId: 1,
        startTime: 'start',
        durationHours: 2,
        getNextSlots: true,
      };
      service.checkAvailabilityByApplication(payload).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/availability/by-application`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ requestedSlotAvailable: true });
    });

    it('getConfig should GET and update the appConfigData signal', () => {
      expect(service.appConfigData()).toBeNull();
      service.getConfig().subscribe();

      const req = httpMock.expectOne(`${apiUrl}/config`);
      expect(req.request.method).toBe('GET');
      req.flush(mockAppConfig);

      expect(service.appConfigData()).toEqual(mockAppConfig);
    });

    describe('checkLessDurationSlotsApplication', () => {
      const baseRequest: AvailabilityByApplicationRequest = {
        applicationId: 1,
        startTime: '2025-01-01T10:00:00Z',
        durationHours: 0,
        getNextSlots: false,
      };

      it('should return the first available slot it finds', () => {
        const durations = [4, 3, 2, 1];
        const successResponse: AvalaibilityByApplication = {
          nextAvailableSlots: [{ startTime: 'start' }],
        };
        const emptyResponse: AvalaibilityByApplication = {
          nextAvailableSlots: [],
        };

        let result: AvalaibilityByApplication | null = null;
        service
          .checkLessDurationSlotsApplication(durations, baseRequest)
          .subscribe((res) => {
            result = res;
          });
        const req1 = httpMock.expectOne(
          `${apiUrl}/availability/by-application`
        );
        expect(req1.request.body.durationHours).toBe(1);
        req1.flush(emptyResponse);
        const req2 = httpMock.expectOne(
          `${apiUrl}/availability/by-application`
        );
        expect(req2.request.body.durationHours).toBe(2);
        req2.flush(successResponse);
        httpMock.expectNone(`${apiUrl}/availability/by-application`);

        expect(result).toEqual(successResponse);
      });

      it('should return null if no slots are found for any duration', () => {
        const durations = [2, 1];
        const emptyResponse: AvalaibilityByApplication = {
          nextAvailableSlots: [],
        };

        let result: AvalaibilityByApplication | null = {
          requestedSlotAvailable: true,
        };
        service
          .checkLessDurationSlotsApplication(durations, baseRequest)
          .subscribe((res) => {
            result = res;
          });

        const req1 = httpMock.expectOne(
          `${apiUrl}/availability/by-application`
        );
        expect(req1.request.body.durationHours).toBe(1);
        req1.flush(emptyResponse);

        const req2 = httpMock.expectOne(
          `${apiUrl}/availability/by-application`
        );
        expect(req2.request.body.durationHours).toBe(2);
        req2.flush(emptyResponse);

        expect(result).toBeNull();
      });
    });
  });

  describe('Reservation Management Methods', () => {
    it('createReservation should POST, update signal, and manage loader', fakeAsync(() => {
      const newReservationPayload: NewReservation = {
        primaryApplicationId: 1,
        secondaryApplicationIds: [],
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      };
      const createdReservation: Reservation = {
        ...mockReservations[0],
        id: 2,
      };

      let response: Reservation | undefined;
      service.createReservation(newReservationPayload).subscribe((res) => {
        response = res;
      });

      const req = httpMock.expectOne(`${apiUrl}/reservations`);
      expect(req.request.method).toBe('POST');
      expect(loaderService.show).toHaveBeenCalled();

      req.flush(createdReservation);
      tick();

      expect(response).toEqual(createdReservation);
      expect(service.reservations()).toContainEqual(createdReservation);
      expect(loaderService.hide).toHaveBeenCalled();
    }));

    it('cancelReservation should POST, update signal, and manage loader', fakeAsync(() => {
      service.fetchReservations().subscribe();
      const setupReq = httpMock.expectOne(`${apiUrl}/reservations`);
      setupReq.flush(mockReservations);
      tick();

      const reservationToCancel = mockReservations[0];
      const canceledReservation: Reservation = {
        ...reservationToCancel,
        status: 'CANCELLED',
      };

      service.cancelReservation(reservationToCancel.id).subscribe();

      const req = httpMock.expectOne(
        `${apiUrl}/reservations/${reservationToCancel.id}/cancel`
      );
      expect(req.request.method).toBe('POST');
      expect(loaderService.show).toHaveBeenCalled();

      req.flush(canceledReservation);
      tick();

      const updated = service
        .reservations()
        .find((r) => r.id === reservationToCancel.id);
      expect(updated?.status).toBe('CANCELLED');
      expect(loaderService.hide).toHaveBeenCalled();
    }));

    it('callMakeReservation should manage loader correctly', fakeAsync(() => {
      const payload: MakeReservationRequest = {
        primaryApplicationId: 1,
        secondaryApplicationIds: [],
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      };
      service.callMakeReservation(payload).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/reservations`);
      expect(req.request.method).toBe('POST');
      expect(loaderService.show).toHaveBeenCalled();

      req.flush({ id: 123 });
      tick();

      expect(loaderService.hide).toHaveBeenCalled();
    }));
  });
});
