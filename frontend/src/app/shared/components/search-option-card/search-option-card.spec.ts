import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchOptionCardComponent } from './search-option-card';

describe('SearchOptionCard', () => {
  let component: SearchOptionCardComponent;
  let fixture: ComponentFixture<SearchOptionCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchOptionCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchOptionCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
