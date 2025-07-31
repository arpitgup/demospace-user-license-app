import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SearchOptionCard } from '../../../utilities/interfaces/search_option_card';

@Component({
  selector: 'app-search-option-card',
  imports: [MatCardModule],
  templateUrl: './search-option-card.html',
  styleUrl: './search-option-card.scss',
})
export class SearchOptionCardComponent {
  @Input() searchOption!: SearchOptionCard;
  @Output() onSelected = new EventEmitter<number>();

  onCardSelected(id: number) {
    this.onSelected.emit(id);
  }
}
