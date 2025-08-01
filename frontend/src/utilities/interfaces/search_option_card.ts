import { SearchType } from '../../app/features/landing/landing.enums';

export interface SearchOptionCard {
  id: number;
  title?: string;
  icon?: string;
  description?: string;
  isSelected?: boolean;
  searchType?: SearchType;
}
