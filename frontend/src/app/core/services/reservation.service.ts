import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  checkAvailabilityByApplication(
    data: AvailabilityByApplicationRequest,
    noSlotsAvailableRequest: AvailabilityByApplicationRequest
  ): Observable<{
    slotsAvailableData: AvalaibilityByApplication;
    noSlotsAvailableData: AvalaibilityByApplication;
  }> {
    return forkJoin({
      slotsAvailableData: this.http.post<AvalaibilityByApplication>(
        `${this.apiUrl}/availability/by-application`,
        data
      ),
      noSlotsAvailableData: this.http.post<AvalaibilityByApplication>(
        `${this.apiUrl}/availability/by-application`,
        noSlotsAvailableRequest
      ),
    });
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
   * Fetches user reservations from the backend API.
   * The 'x-google-user-email' header is now handled by the authInterceptor.
   * @returns An Observable of the user's reservations.
   */
  getReservations(): Observable<Reservation[]> {
    const headers = new HttpHeaders({
      accept: 'application/json',
    });
    return this.http.get<Reservation[]>(`${this.apiUrl}/reservations`, {
      headers,
    });
  }

  /**
   * Fetches a list of all SaaS applications available for reservation.
   * Corresponds to the GET /applications endpoint. [cite: 34, 48]
   * @returns An Observable array of Application objects. [cite: 36, 38]
   */

  /**
   * Creates a new reservation.
   * Corresponds to the POST /reservations endpoint.
   * @param payload The new reservation details.
   * @returns An Observable of the newly created Reservation object.
   */
  createReservation(payload: NewReservation): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.apiUrl}/reservations`, payload);
  }

  /**
   * Cancels an existing reservation.
   * Corresponds to POST /reservations/{id}/cancel.
   * @param reservationId The ID of the reservation to cancel.
   * @returns An Observable of the updated Reservation object.
   */
  cancelReservation(reservationId: number): Observable<Reservation> {
    return this.http.post<Reservation>(
      `${this.apiUrl}/reservations/${reservationId}/cancel`,
      {}
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
