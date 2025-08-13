import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationTableComponent } from '../../shared/components/reservation-table/reservation-table.component';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ReservationService } from '../../core/services/reservation.service';
import { Reservation } from '../../core/models/reservation.model';
import { Observable, of } from 'rxjs';
import { SearchOptionCard } from '../../../utilities/interfaces/search_option_card';
import { ReservationApiStatus, SearchType } from './landing.enums';
import { SearchByDateComponent } from '../search-by-date/search-by-date.component';
import { SearchOptionCardComponent } from '../../shared/components/search-option-card/search-option-card';
import { LANDING_PAGE_CONSTANTS } from './landing.constant';

import { SearchApplicationComponent } from '../search-application/search-application';

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
  private reservationService = inject(ReservationService);
  public readonly landingPageConstants = LANDING_PAGE_CONSTANTS;
  public readonly SearchType = SearchType;

  reservations$!: Observable<Reservation[]>;
  private allReservations: Reservation[] = [];
  private now = new Date();

  selectedSearchType: SearchType | null = null;

  ngOnInit(): void {
    this.fetchReservations();
    this.loadApplications();
  }
  loadApplications() {
    this.reservationService.getApplications().subscribe();
  }

  onShowPastChange(checked: boolean): void {
    this.updateFilteredReservations(checked);
  }

  private updateFilteredReservations(showPast: boolean): void {
    let filteredData: Reservation[];

    if (showPast) {
      filteredData = this.allReservations.filter(
        (res) => res.status === ReservationApiStatus.COMPLETED || res.status === ReservationApiStatus.CANCELLED
      );
    } else {
      filteredData = this.allReservations.filter(
        (res) => res.status === ReservationApiStatus.PENDING || res.status === ReservationApiStatus.ACTIVE
      );
    }
    this.reservations$ = of(filteredData);
  }

  searchOptionCards: SearchOptionCard[] = [
    {
      id: 1,
      icon: 'assets/svgs/date_icon.svg',
      title: 'Search by Date',
      description: 'Reservations must be made 24 hours in advance.',
      isSelected: false,
      searchType: SearchType.ByDate,
    },
    {
      id: 2,
      icon: 'assets/svgs/application_icon.svg',
      title: 'Search by Application',
      description: 'Reservations must be made 24 hours in advance.',
      isSelected: false,
      searchType: SearchType.ByApplication,
    },
  ];
  /**
   * Handles the selection of a search card.
   * @param searchOption The card data object, which could be undefined.
   */

  onCardSelected(searchOption?: SearchOptionCard): void {
    this.selectedSearchType = searchOption?.searchType ?? null;
    this.searchOptionCards = this.searchOptionCards.map((card) => ({
      ...card,
      isSelected: card.id === searchOption?.id,
    }));
  }

  /**
   * Fetches the full list of reservations from the service.
   */
  fetchReservations(): void {
    this.reservationService.getReservations().subscribe((data) => {
      this.allReservations = data;
      this.updateFilteredReservations(false);
    });
  }

  handleCancelReservation(reservation: Reservation): void {
    if (!confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }

    this.reservationService.cancelReservation(reservation.id).subscribe({
      next: () => {
        alert(`Reservation ${reservation.id} cancelled successfully.`);
        this.fetchReservations();
      },
      error: (err) => {
        console.error('Failed to cancel reservation:', err);
      },
    });
  }

}
