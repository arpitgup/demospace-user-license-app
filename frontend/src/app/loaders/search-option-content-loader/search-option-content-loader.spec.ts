import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchOptionContentLoader } from './search-option-content-loader';

describe('SearchOptionContentLoader', () => {
  let component: SearchOptionContentLoader;
  let fixture: ComponentFixture<SearchOptionContentLoader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchOptionContentLoader]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchOptionContentLoader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
