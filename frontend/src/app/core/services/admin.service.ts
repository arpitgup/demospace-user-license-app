import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Reservation } from '../models/reservation.model';
import { isSameDay } from '../../../utilities/utils';
import { BulkCancelReservation } from '../models/bulk-cancel-reservation.model';
import { BulkCancelReservationRequest } from '../models/bulk-cancel-reservation-request.model';
import { ReservationApplicationRequest } from '../models/reservation-application-request.model';
import { AdminBotsResponse } from '../models/admin-bots-response.model';
import { Application } from '../models/application.model';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private botsState = signal<AdminBotsResponse[]>([]);
  public readonly bots = this.botsState.asReadonly();

  private botsErrorState = signal<string[]>([]);
  public readonly botsError = this.botsErrorState.asReadonly();

  fetchAllReservations(): Observable<Reservation[]> {
    return this.http
      .get<Reservation[]>(`${this.apiUrl}/admin/reservations`)
      .pipe(
        map((elements) =>
          elements.map((element) => {
            return {
              ...element,
              isEditable: false,
              isSelect: false,
              isSameDay: isSameDay(
                new Date(element.startTime),
                new Date(element.endTime)
              ),
            };
          })
        )
      );
  }

  bulkCancelreservations(
    cancellationRequest: BulkCancelReservationRequest
  ): Observable<BulkCancelReservation> {
    return this.http.post<BulkCancelReservation>(
      `${this.apiUrl}/admin/reservations/bulk-cancel`,
      cancellationRequest
    );
  }

  updateReservation(
    reservationApplicationRequest: ReservationApplicationRequest,
    reservationId: number
  ): Observable<Reservation> {
    return this.http.patch<Reservation>(
      `${this.apiUrl}/admin/reservations/${reservationId}`,
      reservationApplicationRequest
    );
  }
  
  fetchAllApplications(): Observable<Application[]> {
    return this.http.get<Application[]>(`${this.apiUrl}/admin/applications`);
  }

  
}
