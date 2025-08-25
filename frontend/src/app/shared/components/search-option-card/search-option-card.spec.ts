import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchOptionCard } from '../../../../utilities/interfaces/search_option_card';
import { SearchOptionCardComponent } from './search-option-card';
import { SearchType } from '../../../features/landing/landing.enums';

describe('SearchOptionCard', () => {
  let component: SearchOptionCardComponent;
  let fixture: ComponentFixture<SearchOptionCardComponent>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [],
      providers: [],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchOptionCardComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('shout emit option when card is clicked', () => {
    const searchOption: SearchOptionCard = {
      id: 1,
      icon: 'assets/svgs/date_icon.svg',
      title: 'Search by Date',
      description: 'Reservations must be made 24 hours in advance.',
      searchType: SearchType.ByDate,
    };
    component.searchOption = searchOption;
    jest.spyOn(component.cardClicked, 'emit');
    fixture.detectChanges();
    const cardOption = fixture.nativeElement.querySelector(
      '#card-option-search'
    );
    cardOption.click();
    expect(component.cardClicked.emit).toHaveBeenCalledWith(searchOption);
  });
});
