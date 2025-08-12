import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  delay,
  finalize,
  forkJoin,
  Observable,
  of,
  tap,
} from 'rxjs';
import { Reservation } from '../models/reservation.model';
import { Application } from '../models/application.model';
import { AppConfig } from '../models/appConfig.model';
import { MOCK_RESERVATIONS } from '../mocks/reservation.mock';
import { HttpClient } from '@angular/common/http';
import { AvailabilityByApplicationRequest } from '../models/availabilityByApplicationRequest.model';
import { AvalaibilityByApplication } from '../models/availabilityByApplication.model';
import { MakeReservationRequest } from '../models/makeReservationRequest.model';
import { MakeReservationResponse } from '../models/makeReservationResponse.model';
import { LoaderService } from './loader.service';

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  private applicationApiUrl = 'http://0.0.0.0:8000/applications';
  private applicationSubject = new BehaviorSubject<Application[]>([]);
  public applications$ = this.applicationSubject.asObservable();

  private availabilityByApplicationUrl =
    'http://0.0.0.0:8000/availability/by-application';
  private makeReservationApiUrl = 'http://0.0.0.0:8000/reservations';
  /**
   * Fetches the current user's reservations.
   * Corresponds to GET /users/me/reservations.
   */

  constructor(private http: HttpClient, private loader: LoaderService) {}

  getReservations(): Observable<Reservation[]> {
    return of(MOCK_RESERVATIONS);
  }

  /**
   * Fetches a list of all SaaS applications available for reservation.
   * Corresponds to GET /applications.
   */
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
    console.log(
      'Mock API Call: checkAvailabilityByDate with payload:',
      payload
    );

    // Simulate a response where 3 applications are available for the selected slot.
    const mockAvailableApps: Application[] = [
      { id: 2, name: 'Jira', isSelected: false, isEnabled: true },
      { id: 3, name: 'Slack', isSelected: false, isEnabled: true },
      { id: 5, name: 'ServiceNow', isSelected: false, isEnabled: true },
    ];

    return of({ applications: mockAvailableApps }).pipe(delay(500));
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
