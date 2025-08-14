import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SearchOptionCard } from '../../../../utilities/interfaces/search_option_card';

@Component({
  selector: 'app-search-option-card',
  imports: [MatCardModule],
  templateUrl: './search-option-card.html',
  styleUrl: './search-option-card.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchOptionCardComponent {
  @Input() searchOption?: SearchOptionCard;
  @Input() isSelected: boolean = false;
  @Output() onSelected = new EventEmitter<SearchOptionCard>();

  /**
   * Emits the searchOption object when the card is clicked.
   * This was changed to emit the component's input property directly
   * to avoid potentially emitting an undefined value.
   */
  onCardSelected(): void {
    if (this.searchOption) {
      this.onSelected.emit(this.searchOption);
    }
  }
}
