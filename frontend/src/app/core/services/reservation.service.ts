import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Reservation } from '../models/reservation.model';
import { Application } from '../models/application.model';
import { AppConfig } from '../models/appConfig.model';
import { MOCK_RESERVATIONS } from '../mocks/reservation.mock';

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  /**
   * Fetches the current user's reservations.
   * Corresponds to GET /users/me/reservations.
   */
  getReservations(): Observable<Reservation[]> {
    return of(MOCK_RESERVATIONS);
  }

  /**
   * Fetches a list of all SaaS applications available for reservation.
   * Corresponds to GET /applications.
   */
  getApplications(): Observable<Application[]> {
    const mockApplications: Application[] = [
      { applicationId: 'salesforce', name: 'Salesforce' },
      { applicationId: 'jira', name: 'Jira' },
      { applicationId: 'slack', name: 'Slack' },
    ];
    return of(mockApplications);
  }

  /**
   * Fetches public configuration details for the frontend.
   * Corresponds to GET /config.
   */
  getConfig(): Observable<AppConfig> {
    const mockConfig: AppConfig = {
      reservationBlockDays: 3,
      leadTimeDays: 1,
      calendarViewMonths: 3,
      maxBookingLeadDays: 30,
    };
    return of(mockConfig);
  }
}