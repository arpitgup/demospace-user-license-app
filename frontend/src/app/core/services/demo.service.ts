import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

import { map, Observable, tap } from 'rxjs';

import { DemoDetails } from '../models/demo-details.model';

@Injectable({
  providedIn: 'root',
})
export class DemoService {
  public refreshDemoState = signal<boolean>(false);
  public readonly refreshDemos = this.refreshDemoState.asReadonly();

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  fetchAllDemos(): Observable<DemoDetails[]> {
    return this.http
      .get<DemoDetails[]>(`${this.apiUrl}/admin/get-onboarded-demos`)
      .pipe(
        map((res) => {
          return res.map((item) => {
            return {
              ...item,
              applicationIds: item.saas_applications.split(',').map(Number),
              applications:[]
            };
          });
        })
      );
  }
}
