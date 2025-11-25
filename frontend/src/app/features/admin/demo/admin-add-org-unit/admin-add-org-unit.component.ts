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
import { LoaderService } from '../../../../core/services/loading.service';
import { DemoService } from '../../../../core/services/demo.service';
import { MatDialog } from '@angular/material/dialog';
import { DEMOCONSTANTS } from '../demo.constants';
import { AddOrgUnitRequest } from '../../../../core/models/add-org-unit-request.model';
import { SuccessDialog } from '../../../../shared/dialogs/success-dialog/success-dialog';
import { ErrorDialog } from '../../../../shared/dialogs/error-dialog/error-dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import {
  ADMIN_USER_RESERVATION_EMAIL_VALIDATION,
  NAME_VALIDATION,
  ORG_UNIT_VALIDATION,
} from '../../../../../utilities/utils';

@Component({
  selector: 'app-admin-add-org-unit',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatIconModule,
    ErrorMessage,
  ],
  templateUrl: './admin-add-org-unit.component.html',
  styleUrl: './admin-add-org-unit.component.scss',
})
export class AdminAddOrgUnitComponent implements OnInit {
  private fb = inject(FormBuilder);
  readonly loaderService = inject(LoaderService);
  readonly demoService = inject(DemoService);
  readonly dialog = inject(MatDialog);
  readonly ORG_UNIT_PATH_FORM = 'org_unit_path_form';
  readonly DESCRIPTION_FORM = 'description';
  readonly COST_CENTRE_FORM = 'cost_centre_form';
  readonly MANAGER_NAME_FORM = 'manager_name_form';
  readonly MANAGER_EMAIL_FORM = 'manage_email_form';
  readonly MANAGER_TITLE_FORM = 'manager_title';
  readonly REP_ROLE_FORM = 'rep_role_form';
  readonly REP_DEPARTMENT_FORM = 'rep_department_form';
  public readonly errorMessage = signal<string>('');
  readonly demoConstants = DEMOCONSTANTS;
  addOrgUnitForm: FormGroup = this.fb.group({
    [this.ORG_UNIT_PATH_FORM]: [
      '',
      [Validators.required, Validators.pattern(ORG_UNIT_VALIDATION)],
    ],
    [this.DESCRIPTION_FORM]: ['', Validators.required],
    [this.COST_CENTRE_FORM]: ['', Validators.required],
    [this.MANAGER_NAME_FORM]: [
      '',
      [Validators.required, Validators.pattern(NAME_VALIDATION)],
    ],
    [this.MANAGER_EMAIL_FORM]: [
      '',

      [
        Validators.required,
        Validators.email,
        Validators.pattern(ADMIN_USER_RESERVATION_EMAIL_VALIDATION),
      ],
    ],
    [this.MANAGER_TITLE_FORM]: ['', Validators.required],
    [this.REP_ROLE_FORM]: ['', Validators.required],
    [this.REP_DEPARTMENT_FORM]: ['', Validators.required],
  });
  @Output() orgAddedSuccesfully = new EventEmitter();

  ngOnInit(): void {}

  onCancel() {
    this.orgAddedSuccesfully.emit();
  }
  onConfirm() {
    if (this.addOrgUnitForm.invalid) {
      this.addOrgUnitForm.markAllAsTouched();
      return;
    }
    const payload: AddOrgUnitRequest = {
      orgunitpath: `${
        this.addOrgUnitForm.get(this.ORG_UNIT_PATH_FORM)?.value?.trim() || ''
      }`,
      description:
        this.addOrgUnitForm.get(this.DESCRIPTION_FORM)?.value?.trim() || '',
      cost_centre:
        this.addOrgUnitForm
          .get(this.COST_CENTRE_FORM)
          ?.value?.toString()
          ?.trim() || '',
      manager_name:
        this.addOrgUnitForm.get(this.MANAGER_NAME_FORM)?.value?.trim() || '',
      manager_email:
        this.addOrgUnitForm.get(this.MANAGER_EMAIL_FORM)?.value?.trim() || '',
      manager_title:
        this.addOrgUnitForm.get(this.MANAGER_TITLE_FORM)?.value?.trim() || '',
      rep_role:
        this.addOrgUnitForm.get(this.REP_ROLE_FORM)?.value?.trim() || '',

      rep_department:
        this.addOrgUnitForm
          .get(this.REP_DEPARTMENT_FORM)
          ?.value?.orgunitpath?.trim() || '',
    };
    this.demoService.createNewOrganization(payload).subscribe({
      next: () => {
        this.showSuccessDialog();
      },
      error: (error) => {
        this.showErrorDialog(
          error.error.detail || this.demoConstants.SOMETHING_WENT_WRONG
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
        title: this.demoConstants.SUCCESS,
        message: this.demoConstants.ORG_ADDED_SUCCESSFULLY,
        confirmText: this.demoConstants.OK,
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.demoService.refreshDemoState.update(() => true);
        this.orgAddedSuccesfully.emit();
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
  onRetryCall() {}
}
