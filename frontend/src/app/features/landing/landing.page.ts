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
import { LANDING_PAGE_CONSTANTS } from './landing.constant';
import { SearchOptionCardComponent } from '../../shared/components/search-option-card/search-option-card';
import { SearchOptionCard } from '../../../utilities/interfaces/search_option_card';
import { SearchType } from './landing.enums';
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
    SearchApplicationComponent
  ],
  host: {
    class: 'landing-page-container',
  },
})
export class LandingPage implements OnInit {
  private reservationService = inject(ReservationService);
  public readonly landingPageConstants = LANDING_PAGE_CONSTANTS;

  reservations$!: Observable<Reservation[]>;
  private allReservations: Reservation[] = [];
  private now = new Date();

  ngOnInit(): void {
    this.reservationService.getReservations().subscribe((data) => {
      this.allReservations = data;
      this.updateFilteredReservations(false);
    });
  }

  /**
   * Handles the change event from the 'Show Past Reservations' checkbox.
   * @param checked The new state of the checkbox.
   */
  onShowPastChange(checked: boolean): void {
    this.updateFilteredReservations(checked);
  }

  /**
   * Updates the reservations$ observable based on the filter state.
   * @param showPast If true, shows only past reservations. If false, shows current and upcoming.
   */
  private updateFilteredReservations(showPast: boolean): void {
    let filteredData: Reservation[];

    if (showPast) {
      filteredData = this.allReservations.filter((res) => {
        const endDate = new Date(res.endDate);
        return endDate < this.now;
      });
    } else {
      filteredData = this.allReservations.filter((res) => {
        const endDate = new Date(res.endDate);
        return endDate >= this.now;
      });
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

  onCardSelected(searchOption?: SearchOptionCard) {
    this.searchOptionCards = this.searchOptionCards.map((card) => ({
      ...card,
      isSelected: card.id === searchOption?.id,
    }));
  }
}
