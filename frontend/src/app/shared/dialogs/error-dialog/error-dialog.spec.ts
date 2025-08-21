import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { By } from '@angular/platform-browser';
import { ErrorDialog } from './error-dialog';

describe('ErrorDialog', () => {
  let component: ErrorDialog;
  let fixture: ComponentFixture<ErrorDialog>;
  let matDialogRefMock: MatDialogRef<ErrorDialog>;
  const mockDialogData = {
    message: '<strong>Error:</strong> Something went wrong.',
  };

  beforeEach(async () => {
    matDialogRefMock = {
      close: jest.fn(),
    } as unknown as MatDialogRef<ErrorDialog>;

    await TestBed.configureTestingModule({
      imports: [MatDialogModule, MatIconModule, ErrorDialog],
      providers: [
        { provide: MatDialogRef, useValue: matDialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the error message using innerHTML from MAT_DIALOG_DATA', () => {
    const messageElement = fixture.debugElement.query(
      By.css('mat-dialog-content p')
    ).nativeElement;
    expect(messageElement.innerHTML).toBe(mockDialogData.message);
  });

  it('should call dialogRef.close(true) when onConfirm is called', () => {
    component.onConfirm();
    expect(matDialogRefMock.close).toHaveBeenCalledWith(true);
    expect(matDialogRefMock.close).toHaveBeenCalledTimes(1);
  });

  it('should call dialogRef.close(false) when the close icon button is clicked', () => {
    const closeButton = fixture.debugElement.query(
      By.css('.close-button')
    ).nativeElement;
    closeButton.click();
    expect(matDialogRefMock.close).toHaveBeenCalledWith(false);
    expect(matDialogRefMock.close).toHaveBeenCalledTimes(1);
  });
});
