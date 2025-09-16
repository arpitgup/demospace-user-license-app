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
import { AdminService } from '../../../core/services/admin.service';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ADMIN_RESERVATION_CONSTANTS } from '../admin-reservation/admin-reservation.constant';
import { ReservationApiStatus } from '../../landing/landing.enums';
import { MatDialog } from '@angular/material/dialog';
import { Reservation } from '../../../core/models/reservation.model';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import {
  getLocalTimeZoneAbbreviation,
  isSameDay,
} from '../../../../utilities/utils';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { ErrorDialog } from '../../../shared/dialogs/error-dialog/error-dialog';
import { LoaderService } from '../../../core/services/loading.service';
import { ConfirmationDialog } from '../../../shared/dialogs/confirmation-dialog/confirmation-dialog';
import { BulkCancelReservationRequest } from '../../../core/models/bulk-cancel-reservation-request.model';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { TableLoaderComponent } from '../../../loaders/table-loader/table-loader.component';
import { ReservationApplicationRequest } from '../../../core/models/reservation-application-request.model';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';

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
  readonly adminReservationConstants = ADMIN_RESERVATION_CONSTANTS;
  readonly reservationApiStatus = ReservationApiStatus;
  private dialog = inject(MatDialog);
  public userEmail: string | null = null;
  localTimeAbbrevation: string = '';
  reservationList: Reservation[] = [];
  public showPastReservations = signal(false);
  public selectAllReservations = signal(false);
  public isLoading = signal(false);
  public showCancelCta = signal(false);
  public isRefreshCall = signal(false);
  readonly loadingService = inject(LoaderService);
  minDate: Date = new Date(2025, 7, 1);
  maxDate: Date = new Date();
  today: Date = new Date();
  public readonly pageSizeOptions: number[] = [5];
  private cdr = inject(ChangeDetectorRef);
  public readonly errorMessage = signal<string>('');

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

  @ViewChild(MatPaginator) set paginator(value: MatPaginator) {
    if (value) {
      this.dataSource.paginator = value;
    }
  }

  searchForm: FormGroup = this.fb.group({
    [this.SEARCH_USER_FORM]: [''],
    [this.SEARCH_APPLICATION_FORM]: [''],
    [this.SEARCH_DATE_FORM]: [''],
    [this.SEARCH_BOTID_FORM]: [''],
  });

  ngOnInit(): void {
    this.maxDate.setDate(this.today.getDate() + 60);
    this.localTimeAbbrevation =
      getLocalTimeZoneAbbreviation(
        new Date(new Date()) ?? new Date(),
        Intl.DateTimeFormat().resolvedOptions().timeZone
      ) ?? '';
    if (isPlatformBrowser(this.platformId)) {
      this.userEmail =
        (localStorage?.getItem('userEmail')?.split('@')[0] as string) ?? null;
      if (this.userEmail) {
        this.getAllReservations(true);
      }
    }

    this.listenFormChanges();
  }

  listenFormChanges() {
    this.searchForm.valueChanges?.subscribe(() => {
      if (this.isRefreshCall() === true) {
        return;
      }
      let filteredReservation: Reservation[] = [];
      if (this.showPastReservations() === true) {
        filteredReservation = this.reservationList.filter(
          (item) =>
            item.status === ReservationApiStatus.COMPLETED ||
            item.status === ReservationApiStatus.CANCELLED
        );
      } else {
        filteredReservation = this.reservationList.filter(
          (item) =>
            item.status === ReservationApiStatus.PENDING ||
            item.status === ReservationApiStatus.ACTIVE
        );
      }
      this.fetchSearchReservation(filteredReservation);
    });
  }

  fetchSearchReservation(filteredReservation: Reservation[]) {
    this.dataSource.data = filteredReservation
      .filter((item) =>
        this.searchForm.get(this.SEARCH_APPLICATION_FORM)?.value !== ''
          ? item.applications.some((application) =>
              application.name
                .toLowerCase()
                .includes(
                  this.searchForm.get(this.SEARCH_APPLICATION_FORM)?.value
                )
            )
          : true
      )
      .filter((item) =>
        this.searchForm.get(this.SEARCH_USER_FORM)?.value !== ''
          ? item.userEmail
              .toLowerCase()
              .includes(
                this.searchForm.get(this.SEARCH_USER_FORM)?.value?.toLowerCase()
              )
          : true
      )
      .filter((item) =>
        this.searchForm.get(this.SEARCH_DATE_FORM)?.value !== ''
          ? isSameDay(
              new Date(item.endTime),
              new Date(this.searchForm.get(this.SEARCH_DATE_FORM)?.value)
            )
          : true
      )
      .filter((item) =>
        this.searchForm.get(this.SEARCH_BOTID_FORM)?.value !== ''
          ? item.bot.id
              .toString()
              .includes(this.searchForm.get(this.SEARCH_BOTID_FORM)?.value)
          : true
      );
  }

  getAllReservations(isRefresh: boolean) {
    if (isRefresh) {
      this.isLoading.set(true);
    }
    this.adminService.fetchAllReservations().subscribe({
      next: (data) => {
        this.reservationList = data;
        this.updateReservationDataSource();
        this.updateShowCancelCta(false);
        if (isRefresh) {
          this.isLoading.set(false);
        } else {
          this.loadingService.hide();
        }
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
    this.updateReservationDataSource();
  }
  onSelectAllReservations(checked: boolean): void {
    this.selectAllReservations.set(checked);
    this.dataSource.data = this.dataSource.data.map((item) => {
      return { ...item, isSelect: checked };
    });
    this.updateShowCancelCta(checked);
  }

  onCancelledClicked(checked: boolean, reservationId: number): void {
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

  updateReservationDataSource() {
    if (this.showPastReservations() === true) {
      this.dataSource.data = this.reservationList.filter(
        (item) =>
          item.status === ReservationApiStatus.COMPLETED ||
          item.status === ReservationApiStatus.CANCELLED
      );
    } else {
      this.dataSource.data = this.reservationList.filter(
        (item) =>
          item.status === ReservationApiStatus.PENDING ||
          item.status === ReservationApiStatus.ACTIVE
      );
    }
  }

  onEditCall(reservationId: number) {
    this.dataSource.data = this.dataSource.data.map((item) => {
      if (item.id === reservationId) {
        return { ...item, isEditable: true };
      }
      return item;
    });
    this.cdr.detectChanges();
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
        this.dataSource.data = this.dataSource.data.map((item) => {
          if (item.id === reservationId) {
            item = data;
            return { ...item };
          }
          return item;
        });
      },
      error: (err) => {
        this.loadingService.hide();
        this.showErrorDialog(err?.error?.detail || 'Something went wrong');
      },
    });
  }
  onCancelUpdateReservation(reservationId: number) {
    this.dataSource.data = this.dataSource.data.map((item) => {
      if (item.id === reservationId) {
        item.applications.forEach((element) => (element.isRemove = false));
        return { ...item, isEditable: false };
      }
      return item;
    });
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
    this.getAllReservations(true);
  }
  clearSearchValues() {
    this.isRefreshCall.set(true);
    this.searchForm.get(this.SEARCH_USER_FORM)?.patchValue('');
    this.searchForm.get(this.SEARCH_APPLICATION_FORM)?.patchValue('');
    this.searchForm.get(this.SEARCH_DATE_FORM)?.patchValue('');
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
        message: `Do you want to cancel the booking for<br> Selected (${reservationIds.length}) reservations?`,
        applications: '',
        licenseTitle: '',
        startDateTime: '',
        endDateTime: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
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
        this.getAllReservations(false);
      },
      error: (err) => {
        this.loadingService.hide();
        this.showErrorDialog(err?.error?.detail || 'Something went wrong');
      },
    });
  }

  ngAfterViewInit() {
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'reservationDate':
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
}
