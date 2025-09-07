import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  concatMap,
  defaultIfEmpty,
  filter,
  finalize,
  from,
  Observable,
  take,
  tap,
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
import { MakeReservationRequest } from '../models/make-reservation-request.model';
import { MakeReservationResponse } from '../models/make-reservation-response.model';
import { Application } from '../models/application.model';
import { LoaderService } from './loading.service';

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private applicationSubject = new BehaviorSubject<Application[]>([]);
  public applications$ = this.applicationSubject.asObservable();

  private reservationsState = signal<Reservation[]>([]);
  public readonly reservations = this.reservationsState.asReadonly();

  private configState = signal<AppConfig | null>(null);
  public readonly appConfigData = this.configState.asReadonly();
  loadingService = inject(LoaderService);

  /**
   * API call to check application availability for a given time range.
   * Corresponds to POST /availability/by-date.
   * @param payload An object containing start and end times for the reservation.
   * @returns An Observable containing a list of available applications.
   */
  checkAvailabilityByDate(payload: {
    startTime: string;
    endTime: string;
  }): Observable<{ applications: Application[] }> {
    return this.http.post<{ applications: Application[] }>(
      `${this.apiUrl}/availability/by-date`,
      payload
    );
  }

  checkBotsAvailabilityByDate(payload: {
    startTime: string;
    endTime: string;
  }): Observable<{ availableBots: BotWithApps[] }> {
    return this.http.post<{ availableBots: BotWithApps[] }>(
      `${this.apiUrl}/availability/by-date/v2`,
      payload
    );
  }

  getApplications(): Observable<Application[]> {
    return this.http.get<Application[]>(`${this.apiUrl}/applications`).pipe(
      tap((applications) => {
        this.applicationSubject.next(applications);
      })
    );
  }

  checkAvailabilityByApplication(
    data: AvailabilityByApplicationRequest
  ): Observable<AvalaibilityByApplication> {
    return this.http.post<AvalaibilityByApplication>(
      `${this.apiUrl}/availability/by-application`,
      data
    );
  }
  checkLessDurationSlotsApplication(
    duration: number[],
    data: AvailabilityByApplicationRequest
  ): Observable<AvalaibilityByApplication | null> {
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
    return this.http.get<Reservation[]>(`${this.apiUrl}/reservations`).pipe(
      tap((fetchedReservations) => {
        this.reservationsState.set(fetchedReservations);
      })
    );
  }

  /**
   * Creates a new reservation, then updates the local `reservations` signal.
   * This provides a real-time update to all subscribed components.
   * @param payload The new reservation details.
   * @returns An Observable of the newly created Reservation object.
   */
  createReservation(payload: NewReservation): Observable<Reservation> {
    this.loadingService.show();
    return this.http
      .post<Reservation>(`${this.apiUrl}/reservations`, payload)
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

  callMakeReservation(
    data: MakeReservationRequest
  ): Observable<MakeReservationResponse> {
    this.loadingService.show();
    return this.http
      .post<MakeReservationResponse>(`${this.apiUrl}/reservations`, data)
      .pipe(
        finalize(() => {
          this.loadingService.hide();
        })
      );
  }
}
