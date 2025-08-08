import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Reservation } from '../models/reservation.model';
import { Application } from '../models/reservation.model';
import { AppConfig } from '../models/appConfig.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * API call to check application availability by date range.
   * @param payload An object containing start and end times for the reservation.
   * @returns An Observable of available applications.
   */
  checkAvailabilityByDate(payload: { startTime: string; endTime: string }): Observable<{ applications: Application[] }> {
    const mockApplications: Application[] = [
      { id: 1, name: 'ServiceNow' },
      { id: 2, name: 'Box' },
      { id: 3, name: 'Confluence' },
      { id: 4, name: 'Jira' },
      { id: 5, name: 'Salesforce' },
    ];
    return of({ applications: mockApplications });
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
      maxBookingLeadDays: 30
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
      'accept': 'application/json'
    });
    return this.http.get<Reservation[]>(`${this.apiUrl}/admin/reservations`, { headers });
  }
}
