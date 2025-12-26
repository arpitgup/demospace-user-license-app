import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private userState = signal<User | null>(null);
  public readonly currentUser = this.userState.asReadonly();

  /**
   * Fetches the details of the currently authenticated user and
   * updates the public `currentUser` signal.
   * @returns An Observable of the fetched User object.
   */
  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      tap((user) => {
        this.userState.set(user);
      }),
    );
  }
}