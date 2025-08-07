import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
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
      { id: 1, name: 'ServiceNow' },
      { id: 2, name: 'Office 365' },
      { id: 3, name: 'SharePoint' },
      { id: 4, name: 'Box' },
      { id: 5, name: 'Confluence' },
      { id: 6, name: 'Jira' },
    ];
    return of(mockApplications).pipe(delay(200));
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

   /**
   * Mocks the POST /availability/by-date endpoint.
   * Now returns a list of applications that are available for the given time slot.
   * @param payload An object with startTime and endTime as ISO strings.
   * @returns An observable with an array of available Application objects.
   */
  checkAvailabilityByDate(payload: {
    startTime: string;
    endTime: string;
  }): Observable<{ applications: Application[] }> {
    console.log('Mock API Call: checkAvailabilityByDate with payload:', payload);

    // Simulate a response where 3 applications are available for the selected slot.
    const mockAvailableApps: Application[] = [
      { id: 2, name: 'Jira' },
      { id: 3, name: 'Slack' },
      { id: 5, name: 'ServiceNow' },
    ];

    return of({ applications: mockAvailableApps }).pipe(delay(500));
  }
}
