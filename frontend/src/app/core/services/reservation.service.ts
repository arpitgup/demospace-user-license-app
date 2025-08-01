import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Reservation } from '../models/reservation.model';
import { MOCK_RESERVATIONS } from '../mocks/reservation.mock';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {

  /**
   * Fetches all reservations.
   * use HttpClient to fetch from a backend API.
   */
  getReservations(): Observable<Reservation[]> {
    return of(MOCK_RESERVATIONS);
  }
}
