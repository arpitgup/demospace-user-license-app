import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { catchError, Observable, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class IapService {
  private http = inject(HttpClient);
  private apiUrl = environment.iapUrl;

  public userEmailInfoState = signal<string>('');
  public readonly userEmailInfo = this.userEmailInfoState.asReadonly();

  getIapUserDetails(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/_gcp_iap/identity`).pipe(
      tap((data) => {
        const googleEmail = data.email.split(':')[1];
        if (googleEmail && googleEmail.includes('google.com')) {
          const email = googleEmail.replace(
            /@.*/,
            '-agentspace-demo-user@1987984870407.altostrat.com'
          );
          sessionStorage.setItem('userEmail', email);
          this.userEmailInfoState.update(() => email);
        } else {
          sessionStorage.setItem('userEmail', googleEmail);
          this.userEmailInfoState.update(() => googleEmail);
        }
      }),
      catchError((err) => {
        console.log('error occurred', err);
        this.userEmailInfoState.update(
          () => ''
        );
        return of(null);
      })
    );
  }
}
