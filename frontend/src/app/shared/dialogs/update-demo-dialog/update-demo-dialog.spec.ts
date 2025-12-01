import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateDemoDialog } from './update-demo-dialog';

describe('UpdateDemoDialog', () => {
  let component: UpdateDemoDialog;
  let fixture: ComponentFixture<UpdateDemoDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateDemoDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateDemoDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
