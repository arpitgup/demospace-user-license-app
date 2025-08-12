import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchByApplicationLoader } from './search-by-application-loader';

describe('SearchByApplicationLoader', () => {
  let component: SearchByApplicationLoader;
  let fixture: ComponentFixture<SearchByApplicationLoader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchByApplicationLoader]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchByApplicationLoader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
