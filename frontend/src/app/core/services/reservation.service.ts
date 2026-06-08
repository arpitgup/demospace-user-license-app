import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  catchError,
  concatMap,
  defaultIfEmpty,
  filter,
  finalize,
  from,
  map,
  Observable,
  take,
  tap,
  throwError,
} from 'rxjs';
import {
  BotWithApps,
  NewReservation,
  Reservation,
} from '../models/reservation.model';

import { AppConfig } from '../models/appConfig.model';
import { environment } from '../../../environments/environment';
import { AvailabilityByApplicationRequest } from '../models/availability-by-application-request.model';
import { AvalaibilityByApplication } from '../models/availability-by-application.model';
import { Application } from '../models/application.model';
import { LoaderService } from './loading.service';
import { UserCreationService } from './user-creation.service';

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  private http = inject(HttpClient);
  private userCreationService = inject(UserCreationService);
  private apiUrl = environment.apiUrl;
  private applicationSubject = new BehaviorSubject<Application[]>([]);
  public applications$ = this.applicationSubject.asObservable();

  private reservationsState = signal<Reservation[]>([]);
  public readonly reservations = this.reservationsState.asReadonly();

  private configState = signal<AppConfig | null>(null);
  public readonly appConfigData = this.configState.asReadonly();
  loadingService = inject(LoaderService);
  private readonly reservationErrorMessageState = signal<string>('');
  public readonly reservationErrorMessage =
    this.reservationErrorMessageState.asReadonly();
  private readonly isReservationLoadingState = signal<boolean>(false);
  public readonly isReservationLoading =
    this.isReservationLoadingState.asReadonly();

  /**
   * API call to check application availability for a given time range.
   * Corresponds to POST /availability/by-date.
   * @param payload An object containing start and end times for the reservation.
   * @returns An Observable containing a list of available applications.
   */
  // checkAvailabilityByDate(payload: {
  //   startTime: string;
  //   endTime: string;
  // }): Observable<{ applications: Application[] }> {
  //   return this.http.post<{ applications: Application[] }>(
  //     `${this.apiUrl}/availability/by-date`,
  //     payload
  //   );
  // }

  checkBotsAvailabilityByDate(payload: {
  startTime: string;
  endTime: string;
}, demoId: string): Observable<{ availableBots: BotWithApps[] }> {
    return this.http
      .post<{ availableBots: BotWithApps[] }>(
        `${this.apiUrl}/availability/by-date/v2?demoId=${demoId}`,
        payload
      )
      .pipe(
        map((res) => {
          const saasApplications = this.getSaasApplications();
          if (saasApplications.length > 0) {
            res.availableBots = res.availableBots
              .map((item) => {
                return {
                  ...item,
                  applications: item.applications.filter((element) =>
                    saasApplications.includes(element.id)
                  ),
                };
              })
              .filter((element) => element.applications.length > 0);
          }
          return res;
        })
      );
  }

  /**
   * API call to get applications and return response with specific to demo id i.e only that applications visible to user whicg are enable for demo
   */
  getApplications(): Observable<Application[]> {
    return this.http.get<Application[]>(`${this.apiUrl}/applications`).pipe(
      map((applications) => {
        const saasApplications = this.getSaasApplications();
        applications = applications.filter((item) =>
          saasApplications.includes(item.id)
        );
        this.applicationSubject.next(applications);
        return applications;
      })
    );
  }

  /**
   * API call to check availaibility of bots with specific to applications
   */
  checkAvailabilityByApplication(
    data: AvailabilityByApplicationRequest
  ): Observable<AvalaibilityByApplication> {
    return this.http
      .post<AvalaibilityByApplication>(
        `${this.apiUrl}/availability/by-application`,
        data
      )
      .pipe(
        map((res) => {
          const saasApplications = this.getSaasApplications();
          if (saasApplications.length > 0) {
            res.nextAvailableSlots = this.filterSlotsApplications(
              res,
              saasApplications
            );
          }
          return res;
        })
      );
  }

  /**
   * API call to get less duration slots if required slot is not available in search by application option
   */
  checkLessDurationSlotsApplication(
    duration: number[],
    data: AvailabilityByApplicationRequest
  ): Observable<AvalaibilityByApplication | null> {
    const saasApplications = this.getSaasApplications();
    return from([...duration].reverse()).pipe(
      concatMap((durationValue) => {
        const request = {
          ...data,
          getNextSlots: false,
          durationHours: durationValue,
        };
        return this.checkAvailabilityByApplication(request);
      }),
      filter((res: AvalaibilityByApplication) =>
        (res.nextAvailableSlots?.length ?? 0) >= 1 ? true : false
      ),
      take(1),
      map((res) => ({
        ...res,
        nextAvailableSlots: this.filterSlotsApplications(res, saasApplications),
      })),
      defaultIfEmpty(null)
    );
  }

  /**
   * API call to get application configuration.
   * @returns An Observable of the application configuration.
   */
  getConfig(): Observable<AppConfig> {
    return this.http.get<AppConfig>(`${this.apiUrl}/config`).pipe(
      tap((appConfigData) => {
        this.configState.set(appConfigData);
      })
    );
  }

  /**
   * Fetches user reservations and updates the public `reservations` signal.
   * @returns An Observable of the user's reservations. The caller can subscribe
   * to this to know when the fetch operation is complete.
   */
  fetchReservations(): Observable<Reservation[]> {
    this.isReservationLoadingState.set(true);
    return this.http.get<Reservation[]>(`${this.apiUrl}/reservations`).pipe(
      tap((fetchedReservations) => {
        this.reservationErrorMessageState.set('');
        this.reservationsState.set(fetchedReservations);
        this.isReservationLoadingState.set(false);
      }),
      catchError((error) => {
        this.isReservationLoadingState.set(false);
        this.reservationErrorMessageState.set(
          error?.error?.detail || 'Something went wrong'
        );
        return throwError(() => error);
      })
    );
  }

  /**
   * Cancels a reservation, then updates its status in the local `reservations` signal.
   * This ensures the UI reflects the change immediately without a full re-fetch.
   * @param reservationId The ID of the reservation to cancel.
   * @returns An Observable of the updated (canceled) Reservation object.
   */
  cancelReservation(reservationId: number): Observable<Reservation> {
    this.loadingService.show();
    return this.http
      .post<Reservation>(
        `${this.apiUrl}/reservations/${reservationId}/cancel`,
        {}
      )
      .pipe(
        tap((canceledReservation) => {
          this.reservationsState.update((currentReservations) =>
            currentReservations.map((res) =>
              res.id === reservationId ? canceledReservation : res
            )
          );
        }),
        finalize(() => {
          this.loadingService.hide();
        })
      );
  }

  /**
   * Creates a new reservation, then updates the local `reservations` signal.
   * This provides a real-time update to all subscribed components.
   * @param payload The new reservation details.
   * @returns An Observable of the newly created Reservation object.
   */
  createReservation(payload: NewReservation, demoId: string): Observable<Reservation> {
    this.loadingService.show();
    return this.http
      .post<Reservation>(`${this.apiUrl}/reservations/demoId=${demoId}`, payload)
      .pipe(
        tap((newReservation) => {
          this.reservationsState.update((currentReservations) => [
            ...currentReservations,
            newReservation,
          ]);
        }),
        finalize(() => {
          this.loadingService.hide();
        })
      );
  }

  filterSlotsApplications(
    res: AvalaibilityByApplication,
    saasApplications: number[]
  ) {
    return res.nextAvailableSlots
      ?.map((item) => {
        return {
          ...item,
          availableBots: item.availableBots
            ?.map((item) => {
              return {
                ...item,
                applications: item.applications?.filter((item) =>
                  saasApplications.includes(item.id)
                ),
              };
            })
            .filter((item) => (item.applications?.length || 0) > 0),
        };
      })
      .filter((item) => (item.availableBots?.length || 0) > 0);
  }
  /**
   * Get saas applications id's of demo
   */
  getSaasApplications() {
    const demoApplications =
      this.userCreationService.demoDetailsInfo()?.saas_applications || '';
    let saasApplications: number[] = [];
    if (demoApplications !== '') {
      saasApplications = demoApplications.split(',').map(Number);
    }
    return saasApplications;
  }
}
