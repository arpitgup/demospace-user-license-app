import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

import { map, Observable, tap } from 'rxjs';

import { DemoDetails } from '../models/demo-details.model';
import { OrganizationUnit } from '../models/organization-unit.model';
import { OnBoardNewDemoRequest } from '../models/onboard-new-demo-request.model';
import { UpdateDemoRequest } from '../models/update-demo-request.model';
import { AddOrgUnitRequest } from '../models/add-org-unit-request.model';
import { AddOrgUnitResponse } from '../models/add-org-unit-response.model';
import { UpdateDemoDetails } from '../models/update-demo-details.model';

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
        }),
      );
  }

  fetchAllOrganizations(): Observable<OrganizationUnit[]> {
    return this.http.get<OrganizationUnit[]>(
      `${this.apiUrl}/admin/organization/list_organization_units`,
    );
  }

  createNewDemo(payload: OnBoardNewDemoRequest): Observable<DemoDetails> {
    return this.http.post<DemoDetails>(
      `${this.apiUrl}/admin/onboard_new_demo`,
      payload,
    );
  }
  updateOnBoardDemo(
    payload: UpdateDemoRequest,
    demoId: string,
  ): Observable<DemoDetails> {
    return this.http
      .patch<UpdateDemoDetails>(
        `${this.apiUrl}/admin/update-onboarded-demos/${demoId}`,
        payload,
      )
      .pipe(
        map((res) => {
          const demoDetails: DemoDetails = {
            demo_id: res.demo_id,
            demo_title: res.demo_title,
            demo_user_group_email: res.demo_user_group_email,
            demo_onboarding_status: res.demo_onboarding_status,
            feature_license_app: res.feature_license_app,
            saas_applications: res.saas_applications,
            organization_unit: res.organization_unit,
            applicationIds: [],
            applications: [],
            isEdit: false,
            parent_bug_id: res.parent_bug_id,
            artifact_links: res.artifact_links,
            representative_profile: {
              cost_centre: res.cost_centre,
              manager_name: res.manager_name,
              manager_email: res.manager_email,
              manager_title: res.manager_title,
              rep_role: res.rep_role,
              rep_department: res.rep_department,
              org_unit: res.organization_unit,
            },
          };

          return {
            ...demoDetails,
            applicationIds:
              res.saas_applications &&
              res.saas_applications.trim().length > 0 &&
              res.saas_applications !== '0'
                ? res.saas_applications.split(',').map(Number)
                : [],
            applications: [],
          };
        }),
      );
  }

  createNewOrganization(
    payload: AddOrgUnitRequest,
  ): Observable<AddOrgUnitResponse> {
    return this.http.post<AddOrgUnitResponse>(
      `${this.apiUrl}/admin/organization-units`,
      payload,
    );
  }
}
