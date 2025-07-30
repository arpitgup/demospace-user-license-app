import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplicationDateCard } from './application-date-card';

describe('ApplicationDateCard', () => {
  let component: ApplicationDateCard;
  let fixture: ComponentFixture<ApplicationDateCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicationDateCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplicationDateCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
