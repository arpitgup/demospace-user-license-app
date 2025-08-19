import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { getLocalTimeZoneAbbreviation } from '../../../../utilities/utils';

@Component({
  selector: 'app-confirmation-dialog',
  imports: [MatDialogModule, MatIcon, DatePipe],
  templateUrl: './confirmation-dialog.html',
  styleUrl: './confirmation-dialog.scss',
})
export class ConfirmationDialog implements OnInit {
  localTimeAbbrevation: string = '';

  dialogRef = inject(MatDialogRef<ConfirmationDialog>);
  data = inject(MAT_DIALOG_DATA) as {
    title: string;
    message: string;
    applications: string;
    licenseTitle: string;
    startDateTime: string;
    endDateTime: string;
    confirmText: string;
    cancelText: string;
  };
  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  ngOnInit(): void {
    this.localTimeAbbrevation =
      getLocalTimeZoneAbbreviation(
        new Date(this.data.startDateTime) ?? new Date(),
        Intl.DateTimeFormat().resolvedOptions().timeZone
      ) ?? '';
  }
}
