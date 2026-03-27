import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { LoaderService } from '../../../core/services/loading.service';
import { DemoService } from '../../../core/services/demo.service';
import { Application } from '../../../core/models/application.model';
import { OrganizationUnit } from '../../../core/models/organization-unit.model';

import {
  MANAGER_EMAIL_VALIDATION,
  NAME_VALIDATION,
  PARENT_BUG_VALIDATION,
} from '../../../../utilities/utils';
import { ErrorDialog } from '../error-dialog/error-dialog';
import { DemoOnBoardingEnum } from '../../../enums/admin-demo-onboarding.enums';
import { UpdateDemoRequest } from '../../../core/models/update-demo-request.model';
import { DemoDetails } from '../../../core/models/demo-details.model';
import { UpdateDemoConstants } from './update-demo.constants';

@Component({
  selector: 'app-update-demo-dialog',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    MatCheckbox,
    MatDialogModule,
  ],
  templateUrl: './update-demo-dialog.html',
  styleUrl: './update-demo-dialog.scss',
})
export class UpdateDemoDialog implements OnInit {
  dialogRef = inject(MatDialogRef<UpdateDemoDialog>);
  data = inject(MAT_DIALOG_DATA) as {
    application: Application[];
    organizationUnit: OrganizationUnit[];
    demoDetails: DemoDetails;
  };

  demoOnBoardingStatus: DemoOnBoardingEnum[] = [
    DemoOnBoardingEnum.ACTIVE,
    DemoOnBoardingEnum.INACTIVE,
    DemoOnBoardingEnum.DEPRECATED,
  ];

  private fb = inject(FormBuilder);
  readonly loaderService = inject(LoaderService);
  readonly demoService = inject(DemoService);
  readonly dialog = inject(MatDialog);
  readonly DEMO_TITLE_FORM = 'demo_title_form';
  readonly DEMO_GROUP_EMAIL_FORM = 'demo_group_email_form';
  readonly ORGANIZARION_UNIT_FORM = 'organization_unit_form';
  readonly GEMINI_ENTERPRISE_APP_LINK_FORM = 'gemini_enterprise_app_link_form';
  readonly DRIVE_FOLDER_LINK_FORM = 'drive_folder_link_form';
  readonly DEMO_APPLICATION_FORM = 'demo_application_form';
  readonly COST_CENTRE_FORM = 'cost_centre_form';
  readonly MANAGER_NAME_FORM = 'manager_name_form';
  readonly MANAGER_EMAIL_FORM = 'manage_email_form';
  readonly MANAGER_TITLE_FORM = 'manager_title';
  readonly REP_ROLE_FORM = 'rep_role_form';
  readonly REP_DEPARTMENT_FORM = 'rep_department_form';
  readonly PARENT_BUG_ID_FORM = 'parent_bug_id_form';
  readonly ONBOARDING_STATUS = 'onboarding_status';
  readonly featureLicenseApp = signal<boolean>(false);
  readonly adminApplications = signal<Application[]>([]);
  readonly organizationUnit = signal<OrganizationUnit[]>([]);
  readonly selectedApplications = signal<Application[]>([]);
  readonly applicationErrorMessage = signal<string>('');
  public readonly errorMessage = signal<string>('');
  readonly demoConstants = UpdateDemoConstants;
  updateDemoForm: FormGroup = this.fb.group({
    [this.DEMO_TITLE_FORM]: [
      this.data.demoDetails.demo_title,
      [Validators.required],
    ],
    [this.DEMO_GROUP_EMAIL_FORM]: [
      this.data.demoDetails.demo_user_group_email,
      [Validators.required, Validators.email],
    ],
    [this.GEMINI_ENTERPRISE_APP_LINK_FORM]: [
      this.data.demoDetails.gemini_enterprise_app_link,
      [Validators.required, Validators.pattern(/^(https?:\/\/).+/)],
    ],
    [this.DRIVE_FOLDER_LINK_FORM]: [
      this.data.demoDetails.drive_folder_link,
      [Validators.pattern(/^(https?:\/\/).+/)],
    ],
    [this.DEMO_APPLICATION_FORM]: [''],
    [this.ONBOARDING_STATUS]: [this.data.demoDetails.demo_onboarding_status],
    [this.ORGANIZARION_UNIT_FORM]: [
      this.data.demoDetails.organization_unit,
      Validators.required,
    ],
    [this.COST_CENTRE_FORM]: [
      this.data.demoDetails.representative_profile.cost_centre || '',
    ],
    [this.MANAGER_NAME_FORM]: [
      this.data.demoDetails.representative_profile.manager_name || '',
      [Validators.pattern(NAME_VALIDATION)],
    ],
    [this.MANAGER_EMAIL_FORM]: [
      this.data.demoDetails.representative_profile.manager_email || '',

      [Validators.email, Validators.pattern(MANAGER_EMAIL_VALIDATION)],
    ],
    [this.MANAGER_TITLE_FORM]: [
      this.data.demoDetails.representative_profile.manager_title || '',
    ],
    [this.PARENT_BUG_ID_FORM]: [
      this.data.demoDetails.parent_bug_id || '',
      Validators.required,
      // Validators.pattern(PARENT_BUG_VALIDATION),
    ],
    [this.REP_ROLE_FORM]: [
      this.data.demoDetails.representative_profile.rep_role || '',
    ],
    [this.REP_DEPARTMENT_FORM]: [
      this.data.demoDetails.representative_profile.rep_department || '',
    ],
  });

  ngOnInit(): void {
    this.adminApplications.update(() => this.data.application);
    this.featureLicenseApp.update(
      () => this.data.demoDetails.feature_license_app,
    );
    this.organizationUnit.update(() => this.data.organizationUnit);
    this.getDemoApplications(this.data.demoDetails.applicationIds);
  }

  addApp(app: Application): void {
    this.selectedApplications().push(app);
    this.updateDemoForm
      .get(this.DEMO_APPLICATION_FORM)
      ?.patchValue(this.selectedApplications());
    this.adminApplications.update(() =>
      this.adminApplications().map((item) => {
        return {
          ...item,
          isSelected: app.id === item.id ? true : item.isSelected,
        };
      }),
    );
  }

  removeApp(app: Application) {
    this.selectedApplications.set(
      this.selectedApplications().filter((item) => item.id != app.id),
    );
    this.updateDemoForm
      .get(this.DEMO_APPLICATION_FORM)
      ?.patchValue(this.selectedApplications());
    this.adminApplications.update(() =>
      this.adminApplications().map((item) => {
        return {
          ...item,
          isSelected: app.id === item.id ? false : item.isSelected,
        };
      }),
    );
  }

  onSelecteLicenseReservation(isChecked: boolean) {
    this.featureLicenseApp.update(() => isChecked);
  }

  onConfirm() {
    if (this.updateDemoForm.invalid) {
      this.updateDemoForm.markAllAsTouched();
      return;
    }
    const selectedApplicationIds = this.selectedApplications().map(
      (item) => item.id,
    );
    if (
      this.selectedApplications().length <= 0 &&
      this.featureLicenseApp() === true
    ) {
      this.showErrorDialog(
        this.demoConstants.SAAS_APPLICATION_SHOULD_NOT_BE_EMPTY,
      );
      return;
    }
    const applicationIds = selectedApplicationIds.join(',');
    const payload: UpdateDemoRequest = {
      demo_title: this.updateDemoForm.get(this.DEMO_TITLE_FORM)?.value || '',
      demo_user_group_email:
        this.updateDemoForm.get(this.DEMO_GROUP_EMAIL_FORM)?.value || '',
      gemini_enterprise_app_link:
        this.updateDemoForm.get(this.GEMINI_ENTERPRISE_APP_LINK_FORM)?.value ||
        '',
      drive_folder_link:
        this.updateDemoForm.get(this.DRIVE_FOLDER_LINK_FORM)?.value || '',
      demo_onboarding_status:
        this.updateDemoForm.get(this.ONBOARDING_STATUS)?.value || '',
      feature_license_app: this.featureLicenseApp(),
      saas_applications: applicationIds,
      organization_unit:
        this.updateDemoForm.get(this.ORGANIZARION_UNIT_FORM)?.value || '',
      cost_centre:
        this.updateDemoForm
          .get(this.COST_CENTRE_FORM)
          ?.value?.toString()
          ?.trim() || '',
      manager_name:
        this.updateDemoForm.get(this.MANAGER_NAME_FORM)?.value?.trim() || '',
      manager_email:
        this.updateDemoForm.get(this.MANAGER_EMAIL_FORM)?.value?.trim() || '',
      manager_title:
        this.updateDemoForm.get(this.MANAGER_TITLE_FORM)?.value?.trim() || '',
      rep_role:
        this.updateDemoForm.get(this.REP_ROLE_FORM)?.value?.trim() || '',

      rep_department:
        this.updateDemoForm.get(this.REP_DEPARTMENT_FORM)?.value?.trim() || '',
      parent_bug_id:
        this.updateDemoForm
          .get(this.PARENT_BUG_ID_FORM)
          ?.value?.toString()
          ?.trim() || '',
    };
    this.demoService
      .updateOnBoardDemo(payload, this.data.demoDetails.demo_id)
      .subscribe({
        next: (res) => {
          this.dialogRef.close(res);
        },
        error: (error) => {
          this.showErrorDialog(
            error.error.detail || this.demoConstants.SOMETHING_WENT_WRONG,
          );
        },
      });
  }

  getDemoApplications(applicationIds: number[]) {
    this.selectedApplications.update(() =>
      this.data.application.filter((item) => applicationIds.includes(item.id)),
    );
    this.adminApplications.update(() =>
      this.adminApplications().map((item) => {
        return {
          ...item,
          isSelected: applicationIds.includes(item.id),
        };
      }),
    );
    this.updateDemoForm
      .get(this.DEMO_APPLICATION_FORM)
      ?.patchValue(this.selectedApplications());
  }

  onCancel(): void {
    this.dialogRef.close(false);
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
