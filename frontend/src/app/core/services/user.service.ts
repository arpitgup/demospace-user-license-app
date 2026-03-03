import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, retry, tap, timer } from 'rxjs';

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

  public userEmailInfoState = signal<string>('');
  public readonly userEmailInfo = this.userEmailInfoState.asReadonly();

  /**
   * Fetches the details of the currently authenticated user and
   * updates the public `currentUser` signal.
   * @returns An Observable of the fetched User object.
   */
  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      tap((data) => {
        this.userState.set(data);
        if (data.email && data.email.includes('google.com')) {
          const email = data.email.replace(
            /@.*/,
            '-godemos@1987984870407.altostrat.com',
          );
          sessionStorage.setItem('userEmail', email);
          this.userEmailInfoState.update(() => email);
        } else {
          sessionStorage.setItem('userEmail', data.email);
          this.userEmailInfoState.update(() => data.email);
        }
      }),
      retry({
        count: 5,
        delay: (error) => {
          return timer(200);
        },
      }),
      catchError((err) => {
        console.log('error occurred', err);
        this.userEmailInfoState.update(() => '');
        const user: User = {
          email: '',
          givenName: '',
          familyName: '',
          fullName: '',
        };
        return of(user);
      }),
    );
  }
}
