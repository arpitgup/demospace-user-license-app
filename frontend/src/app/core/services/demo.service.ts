import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

import { map, Observable, tap } from 'rxjs';

import { DemoDetails } from '../models/demo-details.model';
import { OrganizationUnit } from '../models/organization-unit.model';
import { OnBoardNewDemoRequest } from '../models/onboard-new-demo-request.model';
import { UpdateDemoRequest } from '../models/update-demo-request.model';

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
              applicationIds:
                item.saas_applications &&
                item.saas_applications.trim().length > 0 &&
                item.saas_applications !== '0'
                  ? item.saas_applications.split(',').map(Number)
                  : [],
              applications: [],
            };
          });
        })
      );
  }

  fetchAllOrganizations(): Observable<OrganizationUnit[]> {
    return this.http.get<OrganizationUnit[]>(
      `${this.apiUrl}/admin/organization/list_organization_units`
    );
  }

  createNewDemo(payload: OnBoardNewDemoRequest): Observable<DemoDetails> {
    return this.http.post<DemoDetails>(
      `${this.apiUrl}/admin/onboard_new_demo`,
      payload
    );
  }
  updateOnBoardDemo(
    payload: UpdateDemoRequest,
    demoId: string
  ): Observable<DemoDetails> {
    return this.http
      .patch<DemoDetails>(
        `${this.apiUrl}/admin/update-onboarded-demos/${demoId}`,
        payload
      )
      .pipe(
        map((res) => {
          return {
            ...res,
            applicationIds:
              res.saas_applications &&
              res.saas_applications.trim().length > 0 &&
              res.saas_applications !== '0'
                ? res.saas_applications.split(',').map(Number)
                : [],
            applications: [],
          };
        })
      );
  }
}
