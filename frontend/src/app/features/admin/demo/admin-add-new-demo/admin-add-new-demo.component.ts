import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormArray,
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
import { DEMOCONSTANTS } from '../demo.constants';
import {
  DEMO_URL_VALIDATION,
  MANAGER_EMAIL_VALIDATION,
  MAX_DEMO_LINK_ADDITION_VALUE,
  MIN_DEMO_LINK_ADDITION_VALUE,
  NAME_VALIDATION,
} from '../../../../../utilities/utils';
import { ArtifactsLinks } from '../../../../core/models/artifacts_link.model';

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
    ErrorMessage,
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
  readonly DEMO_APPLICATION_FORM = 'demo_application_form';
  readonly COST_CENTRE_FORM = 'cost_centre_form';
  readonly MANAGER_NAME_FORM = 'manager_name_form';
  readonly MANAGER_EMAIL_FORM = 'manage_email_form';
  readonly MANAGER_TITLE_FORM = 'manager_title';
  readonly REP_ROLE_FORM = 'rep_role_form';
  readonly PARENT_BUG_ID_FORM = 'parent_bug_id_form';
  readonly REP_DEPARTMENT_FORM = 'rep_department_form';
  readonly APP_LINKS_ARRAY_FORM = 'app_links_array_form';
  readonly APP_LINK_TITLE_FORM = 'app_link_title_form';
  readonly APP_LINK_VALUE_FORM = 'app_link_value_form';
  readonly IS_CLICKABLE_FORM = 'is_clickable_form';
  readonly DEMO_SUMMARY_FORM = 'demo_summary_form';
  readonly featureLicenseApp = signal<boolean>(false);
  readonly adminApplications = signal<Application[]>([]);
  readonly organizationUnit = signal<OrganizationUnit[]>([]);
  readonly selectedApplications = signal<Application[]>([]);
  readonly applicationErrorMessage = signal<string>('');
  public readonly errorMessage = signal<string>('');
  readonly demoConstants = DEMOCONSTANTS;
  readonly maxDemoLinks = MAX_DEMO_LINK_ADDITION_VALUE;
  readonly minDemoLinks = MIN_DEMO_LINK_ADDITION_VALUE;
  addDemoForm: FormGroup = this.fb.group({
    [this.DEMO_ID_FORM]: ['', Validators.required],
    [this.DEMO_TITLE_FORM]: ['', [Validators.required]],
    [this.DEMO_GROUP_EMAIL_FORM]: ['', [Validators.required, Validators.email]],
    [this.DEMO_APPLICATION_FORM]: [''],
    [this.ORGANIZARION_UNIT_FORM]: ['', Validators.required],
    [this.COST_CENTRE_FORM]: [''],
    [this.MANAGER_NAME_FORM]: ['', [Validators.pattern(NAME_VALIDATION)]],
    [this.MANAGER_EMAIL_FORM]: [
      '',

      [Validators.email, Validators.pattern(MANAGER_EMAIL_VALIDATION)],
    ],
    [this.MANAGER_TITLE_FORM]: [''],
    [this.REP_ROLE_FORM]: [''],
    [this.PARENT_BUG_ID_FORM]: [
      '',
      Validators.required,
      // Validators.pattern(PARENT_BUG_VALIDATION),
    ],
    [this.REP_DEPARTMENT_FORM]: [''],
    [this.APP_LINKS_ARRAY_FORM]: this.fb.array([
      this.createAppLinksPairGroup(),
    ]),
    [this.DEMO_SUMMARY_FORM]: [''],
  });

  createAppLinksPairGroup(): FormGroup {
    return this.fb.group({
      [this.APP_LINK_TITLE_FORM]: ['', Validators.required],
      [this.APP_LINK_VALUE_FORM]: [
        '',
        [Validators.required, Validators.pattern(DEMO_URL_VALIDATION)],
      ],
      [this.IS_CLICKABLE_FORM]: [false],
    });
  }
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
          error?.error?.detail || 'Something went wrong',
        );
        this.errorMessage.update(
          () => error?.error?.detail || 'Something went wrong',
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
      }),
    );
  }

  removeApp(app: Application) {
    this.selectedApplications.set(
      this.selectedApplications().filter((item) => item.id != app.id),
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
      }),
    );
  }

  onRetryCall() {
    this.fetchAllAdminApplications();
  }

  onSelecteLicenseReservation(isChecked: boolean) {
    this.featureLicenseApp.update(() => isChecked);
  }

  readonly summaryEditor = viewChild<ElementRef<HTMLDivElement>>('summaryEditor');

  formatText(command: string): void {
    const editor = this.summaryEditor()?.nativeElement;
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      editor.focus();
      return;
    }

    switch (command) {
      case 'bold':
        this.wrapSelection(range, selection, 'b');
        break;
      case 'italic':
        this.wrapSelection(range, selection, 'i');
        break;
      case 'underline':
        this.wrapSelection(range, selection, 'u');
        break;
      case 'insertUnorderedList':
        this.insertList(range, selection);
        break;
      case 'link':
        this.insertLink(range, selection);
        break;
    }
    this.syncSummaryToForm();
  }

  private wrapSelection(range: Range, selection: Selection, tag: string): void {
    const selectedContent = range.extractContents();
    const wrapper = document.createElement(tag);
    wrapper.appendChild(selectedContent);
    range.insertNode(wrapper);
    range.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private insertList(range: Range, selection: Selection): void {
    const selectedContent = range.extractContents();
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    if (selectedContent.textContent?.trim()) {
      li.appendChild(selectedContent);
    } else {
      li.appendChild(document.createTextNode('\u200B'));
    }
    ul.appendChild(li);
    range.insertNode(ul);
    const newRange = document.createRange();
    newRange.selectNodeContents(li);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }

  private insertLink(range: Range, selection: Selection): void {
    const selectedText = range.toString();
    const url = prompt('Enter URL:', 'https://');
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    const content = range.extractContents();
    if (selectedText.trim()) {
      anchor.appendChild(content);
    } else {
      anchor.textContent = url;
    }
    range.insertNode(anchor);
    const newRange = document.createRange();
    newRange.selectNodeContents(anchor);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }

  onSummaryInput(): void {
    this.syncSummaryToForm();
  }

  private syncSummaryToForm(): void {
    const html = this.summaryEditor()?.nativeElement?.innerHTML || '';
    this.addDemoForm.get(this.DEMO_SUMMARY_FORM)?.setValue(html, { emitEvent: false });
  }

  get appLinksFieldsPairs(): FormArray {
    return this.addDemoForm.get(this.APP_LINKS_ARRAY_FORM) as FormArray;
  }

  addAppLinkPairField(): void {
    if (this.appLinksFieldsPairs.length < this.maxDemoLinks) {
      this.appLinksFieldsPairs.push(this.createAppLinksPairGroup());
    }
  }

  removeAppLinkPairField(index: number): void {
    if (this.appLinksFieldsPairs.length > this.minDemoLinks) {
      this.appLinksFieldsPairs.removeAt(index);
    }
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
    const artifactsLinks: ArtifactsLinks[] = [];
    this.appLinksFieldsPairs.controls.forEach((control) => {
      if (control.valid) {
        artifactsLinks.push({
          title:
            control.get(this.APP_LINK_TITLE_FORM)?.value?.toString()?.trim() ||
            '',
          url:
            control.get(this.APP_LINK_VALUE_FORM)?.value?.toString()?.trim() ||
            '',
          is_clickable:
            control.get(this.IS_CLICKABLE_FORM)?.value || false,
        });
      }
    });

    const payload: OnBoardNewDemoRequest = {
      demo_id: `${this.addDemoForm.get(this.DEMO_ID_FORM)?.value?.toString()?.trim() || ''}`,
      demo_title:
        this.addDemoForm.get(this.DEMO_TITLE_FORM)?.value?.toString()?.trim() ||
        '',
      demo_user_group_email:
        this.addDemoForm
          .get(this.DEMO_GROUP_EMAIL_FORM)
          ?.value?.toString()
          ?.trim() || '',
      demo_onboarding_status: DemoOnBoardingEnum.ACTIVE,
      feature_license_app: this.featureLicenseApp(),
      saas_applications: applicationIds,
      organization_unit:
        this.addDemoForm.get(this.ORGANIZARION_UNIT_FORM)?.value?.orgunitpath ||
        '',
      cost_centre:
        this.addDemoForm
          .get(this.COST_CENTRE_FORM)
          ?.value?.toString()
          ?.trim() || '',
      manager_name:
        this.addDemoForm.get(this.MANAGER_NAME_FORM)?.value?.trim() || '',
      manager_email:
        this.addDemoForm.get(this.MANAGER_EMAIL_FORM)?.value?.trim() || '',
      manager_title:
        this.addDemoForm.get(this.MANAGER_TITLE_FORM)?.value?.trim() || '',
      rep_role: this.addDemoForm.get(this.REP_ROLE_FORM)?.value?.trim() || '',

      rep_department:
        this.addDemoForm.get(this.REP_DEPARTMENT_FORM)?.value?.trim() || '',
      parent_bug_id:
        this.addDemoForm
          .get(this.PARENT_BUG_ID_FORM)
          ?.value?.toString()
          ?.trim() || '',
      artifact_links: artifactsLinks,
      demo_summary:
        this.addDemoForm.get(this.DEMO_SUMMARY_FORM)?.value?.trim() || '',
    };
    this.demoService.createNewDemo(payload).subscribe({
      next: () => {
        this.showSuccessDialog();
      },
      error: (error) => {
        this.showErrorDialog(
          error.error.detail || this.demoConstants.SOMETHING_WENT_WRONG,
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
        message: this.demoConstants.DEMO_ONBOARDED_SUCCESS,
        confirmText: this.demoConstants.OK,
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
