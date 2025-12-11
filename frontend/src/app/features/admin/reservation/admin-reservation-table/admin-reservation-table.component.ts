import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { AdminService } from '../../../../core/services/admin.service';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ReservationApiStatus } from '../../../landing/landing.enums';
import { MatDialog } from '@angular/material/dialog';
import { Reservation } from '../../../../core/models/reservation.model';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import {
  getLocalTimeZoneAbbreviation,
  getSearchDateTimezone,
} from '../../../../../utilities/utils';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { ErrorDialog } from '../../../../shared/dialogs/error-dialog/error-dialog';
import { LoaderService } from '../../../../core/services/loading.service';
import { ConfirmationDialog } from '../../../../shared/dialogs/confirmation-dialog/confirmation-dialog';
import { BulkCancelReservationRequest } from '../../../../core/models/bulk-cancel-reservation-request.model';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { TableLoaderComponent } from '../../../../loaders/table-loader/table-loader.component';
import { ReservationApplicationRequest } from '../../../../core/models/reservation-application-request.model';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import { toObservable } from '@angular/core/rxjs-interop';
import { ReservationConstants } from '../reservation.constants';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-admin-reservation-table',
  providers: [provideNativeDateAdapter()],
  imports: [
    MatCheckbox,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    DatePipe,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatPaginatorModule,
    TableLoaderComponent,
    MatSortModule,
    ErrorMessage,
  ],
  templateUrl: './admin-reservation-table.component.html',
  styleUrl: './admin-reservation-table.component.scss',
})
export class AdminReservationTableComponent implements OnInit, AfterViewInit {
  private platformId = inject(PLATFORM_ID);
  private readonly adminService = inject(AdminService);
  private fb = inject(FormBuilder);
  readonly adminReservationConstants = ReservationConstants;
  readonly reservationApiStatus = ReservationApiStatus;
  private dialog = inject(MatDialog);
  public userEmail: string | null = null;
  localTimeAbbrevation: string = '';
  reservationList: Reservation[] = [];
  //ReservationApiResponse used to get previous on call of cancel update
  reservationApiResponse: Reservation[] = [];
  public showPastReservations = signal(false);
  public selectAllReservations = signal(false);
  public isLoading = signal(false);
  public showCancelCta = signal(false);
  public isRefreshCall = signal(false);
  readonly loadingService = inject(LoaderService);
  minDate: Date = new Date(2025, 7, 1);
  maxDate: Date = new Date();
  today: Date = new Date();
  public readonly pageSizeOptions: number[] = [20];
  private cdr = inject(ChangeDetectorRef);
  public readonly errorMessage = signal<string>('');
  totalItems: number = 0;
  pageSize: number = 20;
  pageIndex = 0;
  pageCache: { [key: number]: Reservation[] } = {};
  isDataLoaded = signal(false);

  displayedColumns: string[] = [
    'select',
    'reservationDate',
    'reservedBy',
    'applications',
    'botId',
    'status',
    'action',
  ];
  dataSource = new MatTableDataSource<Reservation>([]);
  readonly SEARCH_USER_FORM = 'searchUser';
  readonly SEARCH_APPLICATION_FORM = 'searchApplication';
  readonly SEARCH_DATE_FORM = 'searchDate';
  readonly SEARCH_BOTID_FORM = 'searchBotId';

  @ViewChild(MatSort) set sort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  searchForm: FormGroup = this.fb.group({
    [this.SEARCH_USER_FORM]: [''],
    [this.SEARCH_APPLICATION_FORM]: [''],
    [this.SEARCH_DATE_FORM]: [''],
    [this.SEARCH_BOTID_FORM]: [''],
  });

  constructor() {
    this.listenNewApplications();
  }
  ngOnInit(): void {
    this.maxDate.setDate(this.today.getDate() + 60);
    this.localTimeAbbrevation =
      getLocalTimeZoneAbbreviation(
        new Date(new Date()) ?? new Date(),
        Intl.DateTimeFormat().resolvedOptions().timeZone
      ) ?? '';
    if (isPlatformBrowser(this.platformId)) {
      // this.userEmail =
      //   (sessionStorage?.getItem('userEmail')?.split('@')[0] as string) ?? null;
      // if (this.userEmail) {

      // }
      this.getAllReservations(true);
    }

    this.listenFormChanges();
  }

  ngAfterViewInit() {
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'reserrvationDate':
          return new Date(item.startTime).getTime();
        case 'reservedBy':
          return item.userEmail;
        default:
          const value = item[property as keyof Reservation];
          return typeof value === 'string' || typeof value === 'number'
            ? value
            : String(value);
      }
    };
  }

  listenFormChanges() {
    this.searchForm.valueChanges
      ?.pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        if (this.isRefreshCall() === true) {
          return;
        }
        this.resetPaginationValues();
      });
  }

  getAllReservations(isRefresh: boolean) {
    if (
      this.pageCache[this.pageIndex] &&
      this.pageCache[this.pageIndex].length > 0
    ) {
      this.dataSource.data = this.pageCache[this.pageIndex];
      this.cdr.detectChanges();
      return;
    }
    if (isRefresh) {
      this.isLoading.set(true);
    }
    const dateValue = this.searchForm.get(this.SEARCH_DATE_FORM)?.value || '';
    let formattedDate = '';
    if (dateValue !== '') {
      const date = new Date(
        this.searchForm.get(this.SEARCH_DATE_FORM)?.value || ''
      );
      formattedDate = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}-${String(date.getDate()).padStart(
        2,
        '0'
      )}T00:00:00${getSearchDateTimezone(
        new Date(new Date()) ?? new Date(),
        Intl.DateTimeFormat().resolvedOptions().timeZone
      )}`;
    }

    this.adminService
      .fetchAllReservations(
        this.pageIndex,
        this.pageSize,
        this.showPastReservations(),
        this.searchForm.get(this.SEARCH_APPLICATION_FORM)?.value || '',
        this.searchForm.get(this.SEARCH_USER_FORM)?.value || '',
        formattedDate,
        this.searchForm.get(this.SEARCH_BOTID_FORM)?.value || ''
      )
      .subscribe({
        next: (data) => {
          if (
            data.totalRecords > 0 &&
            data.data.length <= 0 &&
            this.pageIndex > 0
          ) {
            this.pageIndex = this.pageIndex - 1;
            this.totalItems = 0;
            this.pageCache = {};
            this.getAllReservations(isRefresh);
            return;
          }
          this.totalItems = data.totalRecords;
          this.reservationList = data.data;
          this.reservationApiResponse = this.reservationList.map((element) => ({
            ...element,
          }));

          this.dataSource.data = this.reservationList;
          this.pageCache[this.pageIndex] = this.reservationList.map(
            (element) => ({
              ...element,
            })
          );
          // this.updateReservationDataSource();
          this.updateShowCancelCta(false);
          if (isRefresh) {
            this.isLoading.set(false);
          } else {
            this.loadingService.hide();
          }
          this.isDataLoaded.update(() => true);
        },
        error: (err) => {
          const errorMessage = err?.error?.detail || 'Something went wrong';
          this.errorMessage.set(errorMessage);
          if (isRefresh) {
            this.isLoading.set(false);
          } else {
            this.loadingService.hide();
          }
        },
      });
  }

  onShowPastChange(checked: boolean): void {
    this.showPastReservations.set(checked);
    this.clearSearchValues();
    this.resetPaginationValues();
  }
  resetPaginationValues() {
    this.pageIndex = 0;
    this.totalItems = 0;
    this.pageCache = {};
    this.getAllReservations(true);
  }
  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.getAllReservations(true);
  }
  onSelectAllReservations(checked: boolean): void {
    this.selectAllReservations.set(checked);
    this.dataSource.data = this.dataSource.data.map((item) => {
      return { ...item, isSelect: checked };
    });
    this.updateShowCancelCta(checked);
  }

  onSelectReservationCancelled(checked: boolean, reservationId: number): void {
    this.dataSource.data = this.dataSource.data.map((item) => {
      if (item.id === reservationId) {
        return { ...item, isSelect: checked };
      }
      return item;
    });
    if (this.dataSource.data.some((item) => item.isSelect === true)) {
      this.updateShowCancelCta(true);
    } else {
      this.updateShowCancelCta(false);
    }
  }

  onEditCall(reservationId: number) {
    this.reservationList = this.reservationList.map((item) => {
      if (item.id === reservationId) {
        return { ...item, isEditable: true };
      }
      return item;
    });
    this.pageCache = {};
    this.dataSource.data = this.reservationList;
  }
  onSaveCall(reservationId: number) {
    const primaryApplicationId =
      this.dataSource.data
        .find((item) => item.id === reservationId)
        ?.applications?.find((item) => item.isRemove !== true)?.id ?? 0;
    const secordaryApplicationsIds =
      this.dataSource.data
        .find((item) => item.id === reservationId)
        ?.applications?.filter(
          (item) => item.isRemove !== true && item.id !== primaryApplicationId
        )
        ?.map((item) => item.id) ?? [];
    const request: ReservationApplicationRequest = {
      primaryApplicationId: primaryApplicationId,
      secondaryApplicationIds: secordaryApplicationsIds,
    };
    this.loadingService.show();
    this.adminService.updateReservation(request, reservationId).subscribe({
      next: (data) => {
        this.loadingService.hide();
        this.reservationList = this.reservationList.map((item) => {
          if (item.id === reservationId) {
            item = data;
            return { ...item };
          }
          this.reservationApiResponse = this.reservationList.map((element) => ({
            ...element,
          }));
          return item;
        });
        this.pageCache = {};
        this.dataSource.data = this.reservationList;
      },
      error: (err) => {
        this.loadingService.hide();
        this.showErrorDialog(err?.error?.detail || 'Something went wrong');
      },
    });
  }
  onCancelUpdateReservation(reservationId: number) {
    const reservation = this.reservationApiResponse.find(
      (item) => item.id === reservationId
    );
    this.reservationList = this.reservationList.map((item) => {
      if (item.id === reservationId) {
        item.applications.forEach((element) => (element.isRemove = false));
        return {
          ...item,
          isEditable: false,
          applications: reservation?.applications ?? [],
        };
      }
      return item;
    });
    this.pageCache = {};
    this.dataSource.data = this.reservationList;
  }
  onRemoveApplication(reservation: Reservation, applicationId: number) {
    const count = reservation.applications.filter(
      (item) => (item.isRemove ?? false) === true
    ).length;
    if (count + 1 === reservation.applications.length) {
      this.showErrorDialog(
        'You cannot remove all the applications. Please cancel the reservation if you want to remove all the applications.'
      );
      return;
    }
    reservation.applications.map((item) => {
      if (item.id === applicationId) {
        item.isRemove = true;
      }
      return item;
    });

    this.cdr.detectChanges();
  }
  updateShowCancelCta(value: boolean) {
    this.showCancelCta.set(value);
  }

  onRefreshCall() {
    this.clearSearchValues();
    this.resetPaginationValues();
    this.getAllReservations(true);
  }
  clearSearchValues() {
    this.isRefreshCall.set(true);
    this.searchForm.get(this.SEARCH_USER_FORM)?.patchValue('');
    this.searchForm.get(this.SEARCH_APPLICATION_FORM)?.patchValue('');
    this.searchForm.get(this.SEARCH_DATE_FORM)?.patchValue('');
    this.searchForm.get(this.SEARCH_BOTID_FORM)?.patchValue('');
    this.isRefreshCall.set(false);
  }

  showCancelConfirmationDialog() {
    const reservationIds = this.dataSource.data
      .filter((item) => item.isSelect === true)
      .map((item) => item.id);
    const dialogRef = this.dialog.open(ConfirmationDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        title: 'Are You Sure ?',
        message: `Do you want to <b>delete</b> the booking for<br> Selected (${reservationIds.length}) reservations?`,
        applications: '',
        licenseTitle: '',
        startDateTime: '',
        endDateTime: '',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        isDeleteConfirmation: true,
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.callBulkCancelReservations(reservationIds);
      }
    });
  }

  callBulkCancelReservations(reservationIds: number[]) {
    const cancellationRequest: BulkCancelReservationRequest = {
      reservationIds: reservationIds,
    };
    this.loadingService.show();
    this.adminService.bulkCancelreservations(cancellationRequest).subscribe({
      next: (data) => {
        if (data.failedToCancel.length > 0) {
          this.showErrorDialog(
            `Faild to cancel ${data.failedToCancel.length} reservations`
          );
        }
        this.selectAllReservations.update(() => false);
        this.pageCache = {};
        this.getAllReservations(false);
      },
      error: (err) => {
        this.loadingService.hide();
        this.showErrorDialog(err?.error?.detail || 'Something went wrong');
      },
    });
  }

  showErrorDialog(message: string) {
    this.dialog.open(ErrorDialog, {
      width: 'auto',
      minWidth: '41.86rem',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        message: message,
      },
    });
  }

  onRetryCall() {
    this.getAllReservations(true);
  }

  formatDate(dateTime: string) {
    return new Date(dateTime);
  }
  listenNewApplications() {
    toObservable(this.adminService.refreshReservations).subscribe((value) => {
      if (value === true) {
        this.getAllReservations(true);
      }
      this.adminService.refreshReservationsState.update(() => false);
    });
  }
  updateCacheValues(reservation: Reservation[]) {
    this.pageCache[this.pageIndex] = reservation;
  }
}
