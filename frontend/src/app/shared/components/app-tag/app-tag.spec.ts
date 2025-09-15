import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppTag } from './app-tag';

describe('AppTag', () => {
  let component: AppTag;
  let fixture: ComponentFixture<AppTag>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppTag]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppTag);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
