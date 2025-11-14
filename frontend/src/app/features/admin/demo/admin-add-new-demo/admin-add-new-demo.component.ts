import {
  Component,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { LoaderService } from '../../../../core/services/loading.service';
import { MatDialog } from '@angular/material/dialog';
import { Application } from '../../../../core/models/application.model';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckbox } from '@angular/material/checkbox';

import { AdminService } from '../../../../core/services/admin.service';
import { forkJoin } from 'rxjs';
import { DemoService } from '../../../../core/services/demo.service';
import { OrganizationUnit } from '../../../../core/models/organization-unit.model';
import { OnBoardNewDemoRequest } from '../../../../core/models/onboard-new-demo-request.model';
import { ErrorDialog } from '../../../../shared/dialogs/error-dialog/error-dialog';
import { SuccessDialog } from '../../../../shared/dialogs/success-dialog/success-dialog';
import { DemoOnBoardingEnum } from '../../../../enums/admin-demo-onboarding.enums';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';

@Component({
  selector: 'app-admin-add-new-demo',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    MatCheckbox,
    ErrorMessage
  ],
  templateUrl: './admin-add-new-demo.component.html',
  styleUrl: './admin-add-new-demo.component.scss',
})
export class AdminAddNewDemoComponent implements OnInit {
  private fb = inject(FormBuilder);
  readonly loaderService = inject(LoaderService);
  readonly adminService = inject(AdminService);
  readonly demoService = inject(DemoService);
  readonly dialog = inject(MatDialog);
  readonly DEMO_ID_FORM = 'demo_id_form';
  readonly DEMO_TITLE_FORM = 'demo_title_form';
  readonly DEMO_GROUP_EMAIL_FORM = 'demo_group_email_form';
  readonly ORGANIZARION_UNIT_FORM = 'organization_unit_form';
  readonly GEMINI_ENTERPRISE_APP_LINK_FORM = 'gemini_enterprise_app_link_form';
  readonly DRIVE_FOLDER_LINK_FORM = 'drive_folder_link_form';
  readonly DEMO_APPLICATION_FORM = 'demo_application_form';
  readonly featureLicenseApp = signal<boolean>(false);
  readonly selectedIds = signal<number[]>([]);
  readonly adminApplications = signal<Application[]>([]);
  readonly organizationUnit = signal<OrganizationUnit[]>([]);
  readonly selectedApplications = signal<Application[]>([]);
  readonly applicationErrorMessage = signal<string>('');
  public isLicenseReservation = signal<boolean>(false);
  public readonly errorMessage = signal<string>('');
  addDemoForm: FormGroup = this.fb.group({
    [this.DEMO_ID_FORM]: ['', Validators.required],
    [this.DEMO_TITLE_FORM]: ['', [Validators.required]],
    [this.DEMO_GROUP_EMAIL_FORM]: ['', [Validators.required, Validators.email]],
    [this.GEMINI_ENTERPRISE_APP_LINK_FORM]: [
      '',
      [Validators.required, Validators.pattern(/^(https?:\/\/).+/)],
    ],
    [this.DRIVE_FOLDER_LINK_FORM]: [
      '',
      [Validators.pattern(/^(https?:\/\/).+/)],
    ],
    [this.DEMO_APPLICATION_FORM]: [''],
    [this.ORGANIZARION_UNIT_FORM]: ['', Validators.required],
  });
  @Output() demoOnBoardSuccess = new EventEmitter();

  ngOnInit(): void {
    this.fetchAllAdminApplications();
  }
  fetchAllAdminApplications() {
    this.errorMessage.update(() => '');
    this.loaderService.show();
    forkJoin({
      applications: this.adminService.fetchAllApplications(),
      organizationUnit: this.demoService.fetchAllOrganizations(),
    }).subscribe({
      next: (res) => {
        this.errorMessage.update(() => '');
        this.applicationErrorMessage.set('');
        this.loaderService.hide();
        this.adminApplications.set(res.applications);
        this.organizationUnit.set(res.organizationUnit);
      },
      error: (error) => {
        this.loaderService.hide();
        this.applicationErrorMessage.set(
          error?.error?.detail || 'Something went wrong'
        );
        this.errorMessage.update(
          () => error?.error?.detail || 'Something went wrong'
        );
      },
    });
  }

  addApp(app: Application): void {
    this.selectedApplications().push(app);
    this.addDemoForm
      .get(this.DEMO_APPLICATION_FORM)
      ?.patchValue(this.selectedApplications());
    this.adminApplications.update(() =>
      this.adminApplications().map((item) => {
        return {
          ...item,
          isSelected: app.id === item.id ? true : item.isSelected,
        };
      })
    );
  }

  removeApp(app: Application) {
    this.selectedApplications.set(
      this.selectedApplications().filter((item) => item.id != app.id)
    );
    this.addDemoForm
      .get(this.DEMO_APPLICATION_FORM)
      ?.patchValue(this.selectedApplications());
    this.adminApplications.update(() =>
      this.adminApplications().map((item) => {
        return {
          ...item,
          isSelected: app.id === item.id ? false : item.isSelected,
        };
      })
    );
  }

  onRetryCall() {
    this.fetchAllAdminApplications();
  }

  onSelecteLicenseReservation(isChecked: boolean) {
    this.featureLicenseApp.update(() => isChecked);
  }
  onCancel() {
    this.demoOnBoardSuccess.emit();
  }
  onConfirm() {
    if (this.addDemoForm.invalid) {
      this.addDemoForm.markAllAsTouched();
      return;
    }
    const selectedApplicationIds = this.selectedApplications().map(
      (item) => item.id
    );
    if (
      this.selectedApplications().length <= 0 &&
      this.featureLicenseApp() === true
    ) {
      this.showErrorDialog(
        'Saas applications should not be empty if license reservation is enabled'
      );
      return;
    }
    const applicationIds = selectedApplicationIds.join(',');
    const payload: OnBoardNewDemoRequest = {
      demo_id: `${this.addDemoForm.get(this.DEMO_ID_FORM)?.value || ''}`,
      demo_title: this.addDemoForm.get(this.DEMO_TITLE_FORM)?.value || '',
      demo_user_group_email:
        this.addDemoForm.get(this.DEMO_GROUP_EMAIL_FORM)?.value || '',
      gemini_enterprise_app_link:
        this.addDemoForm.get(this.GEMINI_ENTERPRISE_APP_LINK_FORM)?.value || '',
      drive_folder_link:
        this.addDemoForm.get(this.DRIVE_FOLDER_LINK_FORM)?.value || '',
      demo_onboarding_status: DemoOnBoardingEnum.ACTIVE,
      feature_license_app: this.featureLicenseApp(),
      saas_applications: applicationIds,
      organization_unit:
        this.addDemoForm.get(this.ORGANIZARION_UNIT_FORM)?.value?.orgunitpath ||
        '',
    };
    this.demoService.createNewDemo(payload).subscribe({
      next: () => {
        this.showSuccessDialog();
      },
      error: (error) => {
        this.showErrorDialog(error.error.detail || 'Something went wrong');
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
        message: 'Demo OnBoarded successfully',
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.demoService.refreshDemoState.update(() => true);
        this.demoOnBoardSuccess.emit();
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
}
