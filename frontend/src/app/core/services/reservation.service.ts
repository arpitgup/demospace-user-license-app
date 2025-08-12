import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { NewReservation, Reservation } from '../models/reservation.model';
import { Application } from '../models/reservation.model';
import { AppConfig } from '../models/appConfig.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

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
  getApplications(): Observable<Application[]> {
    // const mockApplications: Application[] = [
    //   { id: 1, name: 'ServiceNow' },
    //   { id: 2, name: 'Office 365' },
    //   { id: 3, name: 'SharePoint' },
    //   { id: 4, name: 'Box' },
    //   { id: 5, name: 'Confluence' },
    //   { id: 6, name: 'Jira' },
    // ];
    // return of(mockApplications).pipe(delay(200));
    return this.http.get<Application[]>(this.applicationApiUrl).pipe(
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
        this.availabilityByApplicationUrl,
        data
      ),
      noSlotsAvailableData: this.http.post<AvalaibilityByApplication>(
        this.availabilityByApplicationUrl,
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
      leadTimeDays: 1, // 24 hours
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
    return this.http.get<Reservation[]>(`${this.apiUrl}/admin/reservations`, {
      headers,
    });
  }

  /**
   * Fetches a list of all SaaS applications available for reservation.
   * Corresponds to the GET /applications endpoint. [cite: 34, 48]
   * @returns An Observable array of Application objects. [cite: 36, 38]
   */
  getApplications(): Observable<Application[]> {
    return this.http.get<Application[]>(`${this.apiUrl}/applications`);
  }

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
      .post<MakeReservationResponse>(this.makeReservationApiUrl, data)
      .pipe(finalize(() => this.loader.hide()));
  }
}
