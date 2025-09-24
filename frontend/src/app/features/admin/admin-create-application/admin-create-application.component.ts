import {
  Component,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AdminCreateApplicationEnums } from './admin-create-application.enums';
import { MatSelectModule } from '@angular/material/select';
import { CreateApplicationRequest } from '../../../core/models/create-application-request.model';
import { AdminService } from '../../../core/services/admin.service';
import { MatDialog } from '@angular/material/dialog';
import { SuccessDialog } from '../../../shared/dialogs/success-dialog/success-dialog';
import { ErrorDialog } from '../../../shared/dialogs/error-dialog/error-dialog';
import { LoaderService } from '../../../core/services/loading.service';
import { ApplicationType } from '../../../core/models/application-type.model';


@Component({
  selector: 'app-admin-create-application',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatIconModule,
    MatSelectModule,
  ],
  templateUrl: './admin-create-application.component.html',
  styleUrl: './admin-create-application.component.scss',
})
export class AdminCreateApplicationComponent implements OnInit {
  private fb = inject(FormBuilder);
  readonly adminService = inject(AdminService);
  readonly loadingService = inject(LoaderService);
  readonly dialog = inject(MatDialog);

  readonly APPLICATION_NAME_FORM = 'applicationName';
  readonly APPLICATION_TYPE_FORM = 'appplicationType';
  readonly PLATFORM_GROUP_EMAIL_FORM = 'platformGroupEmail';
  readonly NUMBER_OF_LICENSES_FORM = 'numberOfLicenses';
  readonly adminApplicationTypeEnums = AdminCreateApplicationEnums;
  readonly applicationType = signal<AdminCreateApplicationEnums | null>(null);
  applicationTypeList: ApplicationType[] = [
    { id: AdminCreateApplicationEnums.ENVIRONMENT, name: 'Environment' },
    { id: AdminCreateApplicationEnums.SUBSCRIPTION, name: 'Subscription' },
  ];

  createApplicationForm: FormGroup = this.fb.group({
    [this.APPLICATION_NAME_FORM]: ['', Validators.required],
    [this.APPLICATION_TYPE_FORM]: ['', [Validators.required]],
    [this.PLATFORM_GROUP_EMAIL_FORM]: [''],
    [this.NUMBER_OF_LICENSES_FORM]: [
      '',
      [Validators.required, Validators.maxLength(3)],
    ],
  });

  @Output() applicationCreationSuccess = new EventEmitter();

  ngOnInit(): void {
    this.listenApplicationType();
  }
  listenApplicationType() {
    this.createApplicationForm
      .get(this.APPLICATION_TYPE_FORM)
      ?.valueChanges?.subscribe((newValue) => {
        this.applicationType.set(newValue);
        if (newValue === AdminCreateApplicationEnums.ENVIRONMENT) {
          this.createApplicationForm
            .get(this.PLATFORM_GROUP_EMAIL_FORM)
            ?.setValidators([
              Validators.required,
              Validators.email,
              Validators.pattern(
                /^[a-zA-Z0-9-]+-agentspace-demo-user@1987984870407.altostrat.com$/
              ),
            ]);
        } else if (newValue === AdminCreateApplicationEnums.SUBSCRIPTION) {
          this.createApplicationForm
            .get(this.PLATFORM_GROUP_EMAIL_FORM)
            ?.setValidators([]);
        }
        this.createApplicationForm
          .get(this.PLATFORM_GROUP_EMAIL_FORM)
          ?.updateValueAndValidity();
      });
  }

  onConfirm() {
    if (this.createApplicationForm.invalid) {
      this.createApplicationForm.markAllAsTouched();
    }
    this.callCreateApplicationApi();
  }
  callCreateApplicationApi() {
    const request: CreateApplicationRequest = {
      name: this.createApplicationForm
        .get(this.APPLICATION_NAME_FORM)
        ?.value?.toString()
        .trim()
        ?.replace(' ', ''),
      is_active: true,
      license_type: this.createApplicationForm.get(this.APPLICATION_TYPE_FORM)
        ?.value,
      license_group: this.createApplicationForm.get(
        this.PLATFORM_GROUP_EMAIL_FORM
      )?.value,
      license_count: this.createApplicationForm.get(
        this.NUMBER_OF_LICENSES_FORM
      )?.value,
    };
    this.loadingService.show();
    this.adminService.createApplication(request).subscribe({
      next: () => {
        this.loadingService.hide();
        this.showSuccessDialog();
      },
      error: (error) => {
        this.loadingService.hide();
        this.showErrorDialog(error?.error?.detail || 'Something went wrong');
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
        message: 'Application successfully added',
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.adminService.refreshApplicationsState.set(true);
        this.applicationCreationSuccess.emit();
      }
    });
  }

  showErrorDialog(errorMessage: string) {
    this.dialog.open(ErrorDialog, {
      width: 'auto',
      minWidth: '41.86rem',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        message: errorMessage,
      },
    });
  }
  onCancel() {
    this.applicationCreationSuccess.emit();
  }
}
