import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoaderService } from './loading.service';

/**
 * Represents a single application associated with a downtime event.
 */
export interface DowntimeApplication {
  id: number;
  name: string;
  isActive: boolean;
}

/**
 * Represents a single downtime record fetched from the server.
 */
export interface Downtime {
  id: number;
  application: DowntimeApplication;
  downtime_start: string;
  downtime_end: string;
  downtime_reason: string;
  created_by: string;
  status: string; // e.g., 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'
  isSameDay?:boolean;
}

/**
 * The request body for scheduling a new downtime.
 */
export interface ScheduleDowntimeRequest {
  applications: number[];
  downtimeStart: string;
  downtimeEnd: string;
  downtimeReason: string;
}

/**
 * The request body for bulk-canceling downtimes.
 */
export interface BulkCancelDowntimeRequest {
  downtimeIds: number[];
}

/**
 * The response body from the bulk-cancel endpoint.
 */
export interface BulkCancelDowntimeResponse {
  successfullyCancelled: number[];
  failedToCancel: number[];
}


@Injectable({
  providedIn: 'root',
})
export class DowntimeService {
  private http = inject(HttpClient);
  private loaderService = inject(LoaderService);
  private apiUrl = environment.apiUrl;

  private downtimesState = signal<Downtime[]>([]);
  public readonly downtimes = this.downtimesState.asReadonly();

  /**
   * Fetches all admin-visible downtimes and updates the public `downtimes` signal.
   * Corresponds to GET /admin/downtimes.
   * @returns An Observable of the downtime list.
   */
  listDowntimes(): Observable<Downtime[]> {
    // this.loaderService.show();
    return this.http.get<Downtime[]>(`${this.apiUrl}/admin/downtimes`).pipe(
      tap((fetchedDowntimes) => {
        this.downtimesState.set(fetchedDowntimes);
      }),
      finalize(() => {
        // this.loaderService.hide();
      })
    );
  }

  /**
   * Schedules a new application downtime, then updates the local `downtimes` signal.
   * Corresponds to POST /admin/schedule_downtime.
   * @param payload The details for the new downtime.
   * @returns An Observable of the newly created Downtime object.
   */
  scheduleDowntime(payload: ScheduleDowntimeRequest): Observable<Downtime> {
    this.loaderService.show();
    return this.http
      .post<Downtime>(`${this.apiUrl}/admin/schedule_downtime`, payload)
      .pipe(
        tap((newDowntime) => {
          this.downtimesState.update((currentDowntimes) => [
            ...currentDowntimes,
            newDowntime,
          ]);
        }),
        finalize(() => {
          this.loaderService.hide();
        })
      );
  }

  /**
   * Cancels multiple downtimes in a single request. On success, it filters the
   * canceled items from the local `downtimes` signal to keep the UI in sync.
   * Corresponds to POST /admin/downtime/bulk-cancel.
   * @param payload An object containing the list of downtime IDs to cancel.
   * @returns An Observable of the cancellation result.
   */
  bulkCancelDowntimes(
    payload: BulkCancelDowntimeRequest
  ): Observable<BulkCancelDowntimeResponse> {
    this.loaderService.show();
    return this.http
      .post<BulkCancelDowntimeResponse>(
        `${this.apiUrl}/admin/downtime/bulk-cancel`,
        payload
      )
      .pipe(
        tap((response) => {
          // On a successful API call, remove the successfully canceled items from our local state
          this.downtimesState.update((currentDowntimes) =>
            currentDowntimes.filter(
              (downtime) =>
                !response.successfullyCancelled.includes(downtime.id)
            )
          );
        }),
        finalize(() => {
          this.loaderService.hide();
        })
      );
  }
}