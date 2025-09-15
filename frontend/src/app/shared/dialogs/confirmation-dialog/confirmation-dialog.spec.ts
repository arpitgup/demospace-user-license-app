import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { By } from '@angular/platform-browser';
import { DatePipe } from '@angular/common';
import { getLocalTimeZoneAbbreviation } from '../../../../utilities/utils';
import { ConfirmationDialog } from './confirmation-dialog';

jest.mock('../../../../utilities/utils', () => ({
  getLocalTimeZoneAbbreviation: jest.fn(),
}));

describe('ConfirmationDialog', () => {
  let component: ConfirmationDialog;
  let fixture: ComponentFixture<ConfirmationDialog>;
  let matDialogRefMock: MatDialogRef<ConfirmationDialog>;
  const mockDialogData = {
    title: 'Test Title',
    message: 'Are you sure you want to proceed?',
    applications: 'Test Application',
    licenseTitle: 'Test License',
    startDateTime: '2025-08-21T18:30:00.000Z',
    endDateTime: '2025-08-22T18:30:00.000Z',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  };

  beforeEach(async () => {
    matDialogRefMock = {
      close: jest.fn(),
    } as unknown as MatDialogRef<ConfirmationDialog>;
    await TestBed.configureTestingModule({
      imports: [
        MatDialogModule,
        MatIconModule,
        DatePipe,
        ConfirmationDialog,
      ],
      providers: [
        { provide: MatDialogRef, useValue: matDialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
      ],
    }).compileComponents();
    (getLocalTimeZoneAbbreviation as jest.Mock).mockReturnValue('TEST_TZ');

    fixture = TestBed.createComponent(ConfirmationDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the correct title and message from MAT_DIALOG_DATA', () => {
    const titleEl = fixture.debugElement.query(
      By.css('h2')
    ).nativeElement;
    const messageEl = fixture.debugElement.query(
      By.css('.booking-details')
    ).nativeElement;

    expect(titleEl.textContent).toBe(mockDialogData.title);
    expect(messageEl.textContent).toContain(mockDialogData.message);
  });

  it('should call getLocalTimeZoneAbbreviation on init and set the value', () => {
    const expectedDate = new Date(mockDialogData.startDateTime);
    const expectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    expect(getLocalTimeZoneAbbreviation).toHaveBeenCalledWith(
      expectedDate,
      expectedTimeZone
    );
    expect(component.localTimeAbbrevation).toBe('TEST_TZ');
  });

  it('should display correctly formatted date and time details', () => {
    const dateElements = fixture.debugElement.queryAll(
      By.css('.application-details')
    );
    expect(dateElements[1].nativeElement.textContent).toContain('August 21, 2025');
    expect(dateElements[2].nativeElement.textContent).toContain('6 PM TEST_TZ');
    expect(dateElements[3].nativeElement.textContent).toContain(
      'August 22, 2025 6 PM TEST_TZ'
    );
  });

  it('should call dialogRef.close(true) when the confirm button is clicked', () => {
    const confirmButton = fixture.debugElement.query(
      By.css('.confirm-button')
    ).nativeElement;
    confirmButton.click();
    expect(matDialogRefMock.close).toHaveBeenCalledWith(true);
    expect(matDialogRefMock.close).toHaveBeenCalledTimes(1);
  });

  it('should call dialogRef.close(false) when the cancel button is clicked', () => {
    const cancelButton = fixture.debugElement.query(
      By.css('.cancel-button')
    ).nativeElement;
    cancelButton.click();
    expect(matDialogRefMock.close).toHaveBeenCalledWith(false);
    expect(matDialogRefMock.close).toHaveBeenCalledTimes(1);
  });

  it('should call dialogRef.close(false) when the close icon button is clicked', () => {
    const closeButton = fixture.debugElement.query(
      By.css('button[mat-icon-button]')
    ).nativeElement;
    closeButton.click();
    expect(matDialogRefMock.close).toHaveBeenCalledWith(false);
    expect(matDialogRefMock.close).toHaveBeenCalledTimes(1);
  });
});
