import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { By } from '@angular/platform-browser';
import { SuccessDialog } from './success-dialog';

describe('SuccessDialog', () => {
  let component: SuccessDialog;
  let fixture: ComponentFixture<SuccessDialog>;
  let matDialogRefMock: MatDialogRef<SuccessDialog>;
  const mockDialogData = {
    title: 'Success!',
    message: 'Your action was <b>completed</b> successfully.',
    confirmText: 'OK',
  };

  beforeEach(async () => {
    matDialogRefMock = {
      close: jest.fn(),
    } as unknown as MatDialogRef<SuccessDialog>;

    await TestBed.configureTestingModule({
      imports: [MatDialogModule, MatIconModule, SuccessDialog],
      providers: [
        { provide: MatDialogRef, useValue: matDialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SuccessDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the correct title from MAT_DIALOG_DATA', () => {
    const titleElement = fixture.debugElement.query(
      By.css('h2')
    ).nativeElement;
    expect(titleElement.textContent).toBe(mockDialogData.title);
  });

  it('should display the message using innerHTML from MAT_DIALOG_DATA', () => {
    const messageElement = fixture.debugElement.query(
      By.css('mat-dialog-content p')
    ).nativeElement;
    expect(messageElement.innerHTML).toBe(mockDialogData.message);
  });

  it('should display the correct confirm button text', () => {
    const confirmButton = fixture.debugElement.query(
      By.css('.confirm-button')
    ).nativeElement;
    expect(confirmButton.textContent.trim()).toBe(mockDialogData.confirmText);
  });

  it('should call dialogRef.close(true) when the confirm button is clicked', () => {
    const confirmButton = fixture.debugElement.query(
      By.css('.confirm-button')
    ).nativeElement;
    confirmButton.click();
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
