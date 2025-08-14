import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  ViewChild,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
  ],
  host: {
    class: 'landing-page-container',
  },
})
export class LandingPage implements OnInit {
  private readonly reservationService = inject(ReservationService);
  public readonly landingPageConstants = LANDING_PAGE_CONSTANTS;
  public readonly SearchType = SearchType;
  private confirmationDialog = inject(MatDialog);

  public selectedSearchType = signal<SearchType | null>(null);
  public showPastReservations = signal(false);
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;

  private readonly reservationsSignal = this.reservationService.reservations;

  public filteredReservations = computed(() => {
    const showPast = this.showPastReservations();
    const reservations = this.reservationsSignal();

    return reservations.filter((res) =>
      showPast
        ? res.status === ReservationApiStatus.COMPLETED ||
          res.status === ReservationApiStatus.CANCELLED
        : res.status === ReservationApiStatus.PENDING ||
          res.status === ReservationApiStatus.ACTIVE
    );
  });

  public readonly resrevations$ = toObservable(this.filteredReservations);

  public readonly searchOptionCards: SearchOptionCard[] = [
    {
      id: 1,
      icon: 'assets/svgs/date_icon.svg',
      title: 'Search by Date',
      description: 'Reservations must be made 24 hours in advance.',
      searchType: SearchType.ByDate,
    },
    {
      id: 2,
      icon: 'assets/svgs/application_icon.svg',
      title: 'Search by Application',
      description: 'Reservations must be made 24 hours in advance.',
      searchType: SearchType.ByApplication,
    },
  ];

  ngOnInit(): void {
    this.reservationService.fetchReservations().subscribe();
    this.reservationService.getApplications().subscribe();
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
    this.reservationService.fetchReservations().subscribe();
  }

  handleCancelReservation(reservation: Reservation): void {
    this.reservationService.cancelReservation(reservation.id).subscribe({
      next: () => {
        console.log(`Reservation ${reservation.id} cancelled successfully.`);
        this.showSuccessDialog(reservation);
      },
      error: (err) => {
        console.error('Failed to cancel reservation:', err);
      },
    });
  }

  bookingSuccess(): void {
    this.tabGroup.selectedIndex = 1;
  }

  showSuccessDialog(reservation: Reservation) {
    const dialogRef = this.confirmationDialog.open(SuccessDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        title: 'Success',
        message: `Reservation ${reservation.id} cancelled successfully.`,
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.reservationService.fetchReservations().subscribe();
      }
    });
  }
}
