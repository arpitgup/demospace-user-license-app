import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  catchError,
  map,
  Observable,
  of,
  retry,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { UserDetails } from '../models/user-details.model';
import { IapService } from './iap.service';
import { DemoDetails } from '../models/demo-details.model';
import { CreateUserRequest } from '../models/create-user-request.model';
import { UpdateUserRequest } from '../models/update-user-request.model';
import { AddUserInGroupRequest } from '../models/add-user-in-group-request.model';

@Injectable({
  providedIn: 'root',
})
export class UserCreationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private iapService = inject(IapService);

  public userInfoState = signal<UserDetails | null>(null);
  public readonly userInfo = this.userInfoState.asReadonly();

  createUser(body: CreateUserRequest): Observable<UserDetails> {
    return this.http
      .post<UserDetails>(
        `${this.apiUrl}/user-management/create_user_in_workspace`,
        body
      )
      .pipe(
        tap((res) => {
          res.is_exist = true;
          this.userInfoState.update(() => res);
        }),
        catchError((err) => {
          this.userInfoState.update(() => null);
          return throwError(() => err);
        })
      );
  }

  getUserDetails(): Observable<boolean> {
    return this.http
      .get<UserDetails>(`${this.apiUrl}/user-management/user-details`)
      .pipe(
        map((response) => {
          this.userInfoState.update(() => response);
          return response.is_exist;
        }),
        retry({
          count: 5,
          delay: (error) => {
            if (error.status === 404) {
              return throwError(() => error);
            }

            return timer(200);
          },
        }),
        catchError(() => {
          const userEmail = this.iapService.userEmailInfo();
          const userDetails: UserDetails = {
            is_exist: false,
            primary_email: userEmail,
            secondary_email: '',
            first_name: '',
            last_name: '',
            user_name: '',
            costCenter: '',
            jobTitle: '',
            department: '',
            orgUnitPath: '',
            demoName: '',
            managerEmail: '',
          };
          this.userInfoState.update(() => userDetails);
          return of(userDetails.is_exist);
        })
      );
  }

  getDemoDetails(demoId: string): Observable<DemoDetails> {
    return this.http
      .get<DemoDetails>(`${this.apiUrl}/user-management/demo-details/${demoId}`)
      .pipe(
        tap((res) => res),
        catchError((err) => {
          return throwError(() => err);
        })
      );
  }

  updateUserDetails(body: UpdateUserRequest): Observable<UserDetails> {
    return this.http
      .post<UserDetails>(
        `${this.apiUrl}/user-management/update_user_profile`,
        body
      )
      .pipe(
        tap((res) => {
          res.is_exist = true;
        }),

        catchError((err) => {
          return throwError(() => err);
        })
      );
  }

  addUserToGroup(body: AddUserInGroupRequest): Observable<DemoDetails> {
    return this.http
      .post<DemoDetails>(
        `${this.apiUrl}/user-management/adding_user_to_group`,
        body
      )
      .pipe(
        tap((res) => res),

        catchError((err) => {
          return throwError(() => err);
        })
      );
  }

  resetUserPassword(): Observable<UserDetails> {
    return this.http
      .post<UserDetails>(
        `${this.apiUrl}/user-management/reset_user_password`,
        null
      )
      .pipe(
        tap((res) => {
          res.is_exist = true;
          res.user_name=this.userInfo()?.user_name || '';
          this.userInfoState.update(() => res);
        }),

        catchError((err) => {
          return throwError(() => err);
        })
      );
  }
}
