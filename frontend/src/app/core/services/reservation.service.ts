import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, finalize, forkJoin, Observable, of, tap } from 'rxjs';
import { NewReservation, Reservation } from '../models/reservation.model';

import { AppConfig } from '../models/appConfig.model';
import { environment } from '../../../environments/environment';
import { AvailabilityByApplicationRequest } from '../models/availabilityByApplicationRequest.model';
import { AvalaibilityByApplication } from '../models/availabilityByApplication.model';
import { MakeReservationRequest } from '../models/makeReservationRequest.model';
import { MakeReservationResponse } from '../models/makeReservationResponse.model';
import { LoaderService } from './loader.service';
import { Application } from '../models/application.model';

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  private http = inject(HttpClient);
  private loader = inject(LoaderService);
  private apiUrl = environment.apiUrl;
  private applicationSubject = new BehaviorSubject<Application[]>([]);
  public applications$ = this.applicationSubject.asObservable();
  private reservationSubject = new BehaviorSubject<Reservation[]>([]);
  public reservation$ = this.reservationSubject.asObservable();

  private reservationsState = signal<Reservation[]>([]);
  public readonly reservations = this.reservationsState.asReadonly();

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

  getApplications(): Observable<Application[]> {
    return this.http.get<Application[]>(`${this.apiUrl}/applications`).pipe(
      tap((applications) => {
        this.applicationSubject.next(applications);
      })
    );
  }

  getUserReservations(): Observable<Reservation[]> {
    const headers = new HttpHeaders({
      accept: 'application/json',
    });
    return this.http
      .get<Reservation[]>(`${this.apiUrl}/reservations`, {
        headers,
      })
      .pipe(
        tap((reservations) => {
          this.reservationSubject.next(reservations);
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
    const mockConfig: AppConfig = {
      reservationBlockDays: 2,
      leadTimeDays: 1,
      calendarViewMonths: 3,
      maxBookingLeadDays: 30,
    };
    return of(mockConfig);
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
    return this.http
      .post<Reservation>(`${this.apiUrl}/reservations`, payload)
      .pipe(
        tap((newReservation) => {
          this.reservationsState.update((currentReservations) => [
            ...currentReservations,
            newReservation,
          ]);
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
        })
      );
  }

  callMakeReservation(
    data: MakeReservationRequest
  ): Observable<MakeReservationResponse> {
    this.loader.show();
    return this.http
      .post<MakeReservationResponse>(`${this.apiUrl}/reservations`, data)
      .pipe(finalize(() => this.loader.hide()));
  }
}
