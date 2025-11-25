import { Component, inject, OnInit, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { Application } from '../../../core/models/application.model';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-assign-applications-bots-dialog',
  imports: [ MatDialogModule, MatIcon],
  templateUrl: './assign-applications-bots-dialog.html',
  styleUrl: './assign-applications-bots-dialog.scss',
})
export class AssignApplicationsBotsDialog implements OnInit {
  dialogRef = inject(MatDialogRef<AssignApplicationsBotsDialog>);
  public selectedApplications = signal('');
  data = inject(MAT_DIALOG_DATA) as {
    applications: Application[];
  };
  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  ngOnInit(): void {
    this.data.applications = this.data.applications.map((element) => ({
      ...element,
      isEnabled: (element.isEnabled =
        (element.licenseAssignedToBots ?? 0) < (element.licenseCount ?? 0)
          ? true
          : false),
      remainingLicenseCount:
        (element.licenseCount ?? 0) - (element.licenseAssignedToBots ?? 0),
    }));
  }

  onApplicationSelected(app: Application) {
    if(app.isSelected!==true && (app.remainingLicenseCount || 0)<=0){
      return;
    }
    this.data.applications = this.data.applications.map((element) => {
      if (element.id === app.id) {
        element.isSelected = element.isSelected === true ? false : true;
      }
      return element;
    });
    const selectedApplicationList = this.data.applications
      .filter((element) => element.isSelected === true)
      .map((element) => element.name);
    if (selectedApplicationList) {
      this.selectedApplications.set(selectedApplicationList.join(', '));
    }
  }
}
