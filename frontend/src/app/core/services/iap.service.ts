import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { IapIdentity } from '../models/iap-identity.model';
import { catchError, Observable, of, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class IapService {
  private http = inject(HttpClient);
  private apiUrl = environment.iapUrl;

  getIapUserDetails(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/_gcp_iap/identity`).pipe(
      tap((data) => {
        const email = data.email.split(':')[1];
        sessionStorage.setItem('userEmail', email);
      }),
      catchError((err) => {
        console.log("error occurred",err);
        return of(null);
      })
    );
  }
}
