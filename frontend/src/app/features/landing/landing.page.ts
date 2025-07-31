import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ReservationTableComponent } from '../../shared/components/reservation-table/reservation-table.component';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckbox } from '@angular/material/checkbox';
import { SearchOptionCard } from '../../utilities/interfaces/search_option_card';
import { title } from 'process';
import { SearchOptionCardComponent } from '../../shared/components/search-option-card/search-option-card';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTabsModule,
    MatCheckbox,
    ReservationTableComponent,
    SearchOptionCardComponent,
  ],
  host: {
    class: 'landing-page-container',
  },
})
export class LandingPage {
  searchOptionCards: SearchOptionCard[] = [
    {
      id: 1,
      icon: 'assets/svgs/date_icon.svg',
      title: 'Search by Date',
      description: 'Reservations must be made 24 hours in advance.',
      isSelected: false,
    },
    {
      id: 2,
      icon: 'assets/svgs/application_icon.svg',
      title: 'Search by Application',
      description: 'Reservations must be made 24 hours in advance.',
      isSelected: false,
    },
  ];

  onCardSelected(cardId: number) {
    this.searchOptionCards = this.searchOptionCards.map((card) => ({
      ...card,
      isSelected: card.id === cardId,
    }));
  }
}
