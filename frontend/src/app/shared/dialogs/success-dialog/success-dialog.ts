import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-success-dialog',
  imports: [MatDialogModule, MatIcon],
  templateUrl: './success-dialog.html',
  styleUrl: './success-dialog.scss',
})
export class SuccessDialog {
  dialogRef = inject(MatDialogRef<SuccessDialog>);
  data = inject(MAT_DIALOG_DATA) as {
    title: string;
    message: string;
    confirmText: string;
  };

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(true);
  }
}
