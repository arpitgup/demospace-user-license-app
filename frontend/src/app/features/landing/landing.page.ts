import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  ViewChild,
  signal,
  computed,
  PLATFORM_ID,
  ChangeDetectorRef,
  EventEmitter,
  Output,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReservationTableComponent } from '../../shared/components/reservation-table/reservation-table.component';
import {
  MatTabGroup,
  MatTabsModule,
  MatTabChangeEvent,
} from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ReservationService } from '../../core/services/reservation.service';
import { Reservation } from '../../core/models/reservation.model';
import { SearchOptionCard } from '../../../utilities/interfaces/search_option_card';
import { ReservationApiStatus, SearchType } from './landing.enums';
import { SearchByDateComponent } from '../search-by-date/search-by-date.component';
import { SearchOptionCardComponent } from '../../shared/components/search-option-card/search-option-card';
import { LANDING_PAGE_CONSTANTS } from './landing.constant';
import { SearchApplicationComponent } from '../search-application/search-application';
import { toObservable } from '@angular/core/rxjs-interop';
import { SuccessDialog } from '../../shared/dialogs/success-dialog/success-dialog';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { SearchOptionContentLoader } from '../../loaders/search-option-content-loader/search-option-content-loader';
import { UserService } from '../../core/services/user.service';
import { ErrorMessage } from '../../shared/components/error-message/error-message';
import { MIN_LEAD_COOLDOWN_HOURS } from '../search-by-date/search-by-date.constants';
import { ActivatedRoute } from '@angular/router';
import { UserCreationService } from '../../core/services/user-creation.service';
import { logInfo } from '../../../utilities/utils';
import {
  QUERY_DEMO_ID,
  SESSIONS_DEMO_ID,
} from '../../shared/constants/session.constants';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTabsModule,
    MatCheckboxModule,
    ReservationTableComponent,
    SearchOptionCardComponent,
    SearchByDateComponent,
    SearchApplicationComponent,
    MatIcon,
    SearchOptionContentLoader,
    ErrorMessage,
  ],
  host: {
    class: 'landing-page-container',
  },
})
export class LandingPage implements OnInit {
  private readonly userService = inject(UserService);
  private readonly userCreationService = inject(UserCreationService);
  private readonly reservationService = inject(ReservationService);
  public readonly landingPageConstants = LANDING_PAGE_CONSTANTS;
  public readonly SearchType = SearchType;
  private confirmationDialog = inject(MatDialog);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private readonly currentUserSignal = this.userService.currentUser;
  @Output() redirectHowToLogin = new EventEmitter();
  public selectedSearchType = signal<SearchType | null>(null);
  public showPastReservations = signal(false);
  public userEmail: string | null = null;
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
  selectedIndex = 0;

  private readonly reservationsSignal = this.reservationService.reservations;
  isFetchingData: boolean = true;
  isError: boolean = false;
  errorMessage: string = '';
  public readonly reservationErrorSignal =
    this.reservationService.reservationErrorMessage;
  private activeRoute = inject(ActivatedRoute);
  public showUserName = signal<boolean>(false);
  public filteredReservations = computed(() => {
    const showPast = this.showPastReservations();
    const reservations = this.reservationsSignal();

    return reservations
      .filter((res) =>
        showPast
          ? res.status === ReservationApiStatus.COMPLETED ||
            res.status === ReservationApiStatus.CANCELLED
          : res.status === ReservationApiStatus.PENDING ||
            res.status === ReservationApiStatus.ACTIVE,
      )
      .sort((a, b) =>
        showPast
          ? new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          : new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
  });

  public readonly resrevations$ = toObservable(this.filteredReservations);

  public userFullName = computed<string>(
    () => this.currentUserSignal()?.givenName ?? '',
  );

  public readonly searchOptionCards: SearchOptionCard[] = [
    {
      id: 1,
      icon: 'assets/svgs/date_icon.svg',
      title: 'Search by Date',
      description: `Reservations must be made ${MIN_LEAD_COOLDOWN_HOURS} hours in advance.`,
      searchType: SearchType.ByDate,
    },
    {
      id: 2,
      icon: 'assets/svgs/application_icon.svg',
      title: 'Search by Application',
      description: `Reservations must be made ${MIN_LEAD_COOLDOWN_HOURS} hours in advance.`,
      searchType: SearchType.ByApplication,
    },
  ];

  onRefreshData() {
    this.setLoadingErrorValues(true, false, '');
    this.selectedIndex = 0;
    this.selectedSearchType.set(null);
    this.cdr.detectChanges();
    this.reservationService.fetchReservations().subscribe();
    this.callDemoDetailsApi();
  }
  callDemoDetailsApi() {
    const demoId =
      this.activeRoute.snapshot.queryParams[QUERY_DEMO_ID] ||
      sessionStorage.getItem(SESSIONS_DEMO_ID) ||
      '';
    logInfo('landingPageDemoId=', demoId);
    if (
      this.userCreationService.demoDetailsInfo() === null ||
      (this.userCreationService.demoDetailsInfo()?.saas_applications?.trim()
        ?.length || 0) <= 0
    ) {
      this.userCreationService.getDemoDetails(demoId).subscribe({
        next: () => {
          this.callApplicationConfigApi();
        },
        error: (error) => {
          this.errorMessage =
            error.error.detail || 'Something went wrong. Please try again.';
          this.setLoadingErrorValues(false, true, this.errorMessage);
          this.cdr.detectChanges();
        },
      });
    } else {
      this.callApplicationConfigApi();
    }
  }
  callApplicationConfigApi() {
    if (
      (this.userCreationService.demoDetailsInfo()?.saas_applications?.trim()
        ?.length || 0) <= 0
    ) {
      this.errorMessage =
        'Saas applications not configured for this demo. Please file a ticket/feedback.';
      this.setLoadingErrorValues(false, true, this.errorMessage);
      this.cdr.detectChanges();
      return;
    }
    forkJoin({
      user: this.userService.fetchCurrentUser(),
      application: this.reservationService.getApplications(),
      config: this.reservationService.getConfig(),
    }).subscribe({
      next: () => {
        this.setLoadingErrorValues(false, false, '');
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error.error.detail || 'Something went wrong. Please try again.';
        this.setLoadingErrorValues(false, true, this.errorMessage);
        this.cdr.detectChanges();
      },
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.userEmail =
        (sessionStorage?.getItem('userEmail')?.split('@')[0] as string) ?? null;
      if (this.userEmail) {
        this.onRefreshData();
      } else {
        const userEmail =
          this.activeRoute.snapshot.queryParams['userEmail'] || '';

        if (userEmail) {
          sessionStorage.setItem('userEmail', userEmail);
          this.onRefreshData();
        }
      }
      const currentPath = this.activeRoute.snapshot.url
        .map((segment) => segment.path)
        .join('/');
      if (currentPath.includes('license-reservation')) {
        this.showUserName.update(() => true);
      }
    }
  }

  onShowPastChange(checked: boolean): void {
    this.showPastReservations.set(checked);
  }

  onCardSelected(searchOption: SearchOptionCard): void {
    this.selectedSearchType.set(searchOption?.searchType ?? null);
  }

  /**
   * Fetches reservations when the "Your Reservations" tab is selected for the first time.
   * @param event The MatTabChangeEvent object.
   */
  onTabChange(event: MatTabChangeEvent): void {
    this.selectedIndex = event.index;
    if (event) {
      this.reservationService.fetchReservations().subscribe();
    }
  }

  handleCancelReservation(reservation: Reservation): void {
    this.reservationService.cancelReservation(reservation.id).subscribe({
      next: () => {
        console.log(`Reservation ${reservation.id} cancelled successfully.`);
        this.showSuccessDialog();
      },
      error: (err) => {
        console.error('Failed to cancel reservation:', err);
      },
    });
  }

  bookingSuccess(): void {
    this.tabGroup.selectedIndex = 1;
  }

  showSuccessDialog() {
    const dialogRef = this.confirmationDialog.open(SuccessDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        title: 'Success',
        message: `Reservation cancelled successfully!`,
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.reservationService.fetchReservations().subscribe();
      }
    });
  }
  onRetryCall() {
    this.setLoadingErrorValues(true, false, '');
    this.callDemoDetailsApi();
  }
  setLoadingErrorValues(
    isLoading: boolean,
    isError: boolean,
    errorMessage: string,
  ) {
    this.isFetchingData = isLoading;
    this.isError = isError;
    this.errorMessage = errorMessage;
  }
  redirectToHowToLogin() {
    this.redirectHowToLogin.emit();
  }
}
