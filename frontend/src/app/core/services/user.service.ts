import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, retry, tap, timer } from 'rxjs';

import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';
import { EMAIL_DOMAIN } from '../../shared/constants/domain.constants';
import {
  QUERY_DEMO_ID,
  SESSIONS_DEMO_ID,
} from '../../shared/constants/session.constants';
import { ActivatedRoute } from '@angular/router';
import { logInfo } from '../../../utilities/utils';

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
        sessionStorage.setItem(SESSIONS_DEMO_ID, '');
        const activeRoute = inject(ActivatedRoute);
        activeRoute.queryParams.subscribe((params) => {
          const demoId = params[QUERY_DEMO_ID] || '';
          logInfo('appConfigDemoId=', demoId);
          sessionStorage.setItem(SESSIONS_DEMO_ID, demoId);
        });
        this.userState.set(data);
        if (data.email && data.email.includes('google.com')) {
          const email = data.email.replace(/@.*/, EMAIL_DOMAIN);
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
        sessionStorage.setItem(SESSIONS_DEMO_ID, '');
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
