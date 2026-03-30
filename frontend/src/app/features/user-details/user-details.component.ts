import { Component, inject, Input, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { UserCreationService } from '../../core/services/user-creation.service';
import { DemoDetails } from '../../core/models/demo-details.model';
import { UpdateUserRequest } from '../../core/models/update-user-request.model';
import { LoaderService } from '../../core/services/loading.service';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialog } from '../../shared/dialogs/error-dialog/error-dialog';
import { SuccessDialog } from '../../shared/dialogs/success-dialog/success-dialog';
import { GOOGLE_EMAIL_DOMAIN } from '../../shared/constants/domain.constants';

@Component({
  selector: 'app-user-details',
  imports: [
    MatCardModule,
    ReactiveFormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './user-details.component.html',
  styleUrl: './user-details.component.scss',
})
export class UserDetailsComponent {
  private userService = inject(UserCreationService);
  profileDetails = this.userService.userInfo();
  @Input() demoDetails!: DemoDetails;
  public isEditable = signal<boolean>(false);
  private loaderService = inject(LoaderService);
  private dialog = inject(MatDialog);
  readonly FIRST_NAME_FORM = 'firstName';
  readonly LAST_NAME_FORM = 'lastName';
  private fb = inject(FormBuilder);
  updateUserForm: FormGroup = this.fb.group({
    [this.FIRST_NAME_FORM]: [
      this.profileDetails?.first_name || '',
      [Validators.required, Validators.pattern('^[a-zA-Z]+$')],
    ],
    [this.LAST_NAME_FORM]: [
      this.profileDetails?.last_name || '',
      [Validators.required, Validators.pattern('^[a-zA-Z]+$')],
    ],
  });

  onEditable() {
    this.isEditable.update(() => true);
  }
  onUpdateDetails() {
    if (this.updateUserForm.invalid) {
      return;
    }
    this.loaderService.show();
    const primaryEmail = sessionStorage.getItem('userEmail') ?? '';
    const secondaryEmail = primaryEmail.replace(/@.*/, GOOGLE_EMAIL_DOMAIN);
    const request: UpdateUserRequest = {
      primary_email: primaryEmail,
      secondary_email: secondaryEmail,
      first_name: this.updateUserForm.get(this.FIRST_NAME_FORM)?.value ?? '',
      last_name: this.updateUserForm.get(this.LAST_NAME_FORM)?.value ?? '',
      costCenter: this.demoDetails.representative_profile.cost_centre,
      jobTitle: this.demoDetails.representative_profile.rep_role,
      department: this.demoDetails.representative_profile.rep_department,
      orgUnitPath: this.demoDetails.organization_unit,
      demoName: this.demoDetails.demo_title,
      managerEmail: this.demoDetails.representative_profile.manager_email,
      employeeID: this.userService.userInfo()?.employeeID ?? '',
    };
    return this.userService.updateUserDetails(request).subscribe({
      next: (res) => {
        this.userService.userInfoState.update(() => res);
        this.loaderService.hide();
        this.isEditable.update(() => false);
        this.profileDetails = this.userService.userInfo();
        this.showSuccessDialog();
      },
      error: (err) => {
        this.loaderService.hide();
        this.showErrorDialog(
          err?.error?.detail || 'Something went wrong. Please try again'
        );
      },
    });
  }

  showSuccessDialog() {
    const dialogRef = this.dialog.open(SuccessDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        title: 'Success',
        message: 'User details updated successfully',
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed().subscribe(() => {});
  }

  showErrorDialog(message: string) {
    this.dialog.open(ErrorDialog, {
      width: 'auto',
      minWidth: '41.86rem',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        message: message,
      },
    });
  }
}
