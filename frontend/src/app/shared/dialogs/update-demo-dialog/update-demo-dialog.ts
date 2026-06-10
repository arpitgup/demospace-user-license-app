import { AfterViewInit, Component, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import {
  FormArray,
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
  DEMO_URL_VALIDATION,
  MANAGER_EMAIL_VALIDATION,
  MAX_DEMO_LINK_ADDITION_VALUE,
  MIN_DEMO_LINK_ADDITION_VALUE,
  NAME_VALIDATION,
} from '../../../../utilities/utils';
import { ErrorDialog } from '../error-dialog/error-dialog';
import { DemoOnBoardingEnum } from '../../../enums/admin-demo-onboarding.enums';
import { UpdateDemoRequest } from '../../../core/models/update-demo-request.model';
import { DemoDetails } from '../../../core/models/demo-details.model';
import { UpdateDemoConstants } from './update-demo.constants';
import { ArtifactsLinks } from '../../../core/models/artifacts_link.model';

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
export class UpdateDemoDialog implements OnInit, AfterViewInit {
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
  readonly DEMO_APPLICATION_FORM = 'demo_application_form';
  readonly COST_CENTRE_FORM = 'cost_centre_form';
  readonly MANAGER_NAME_FORM = 'manager_name_form';
  readonly MANAGER_EMAIL_FORM = 'manage_email_form';
  readonly MANAGER_TITLE_FORM = 'manager_title';
  readonly REP_ROLE_FORM = 'rep_role_form';
  readonly REP_DEPARTMENT_FORM = 'rep_department_form';
  readonly PARENT_BUG_ID_FORM = 'parent_bug_id_form';
  readonly ONBOARDING_STATUS = 'onboarding_status';
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
  readonly demoConstants = UpdateDemoConstants;
  readonly maxDemoLinks = MAX_DEMO_LINK_ADDITION_VALUE;
  readonly minDemoLinks = MIN_DEMO_LINK_ADDITION_VALUE;
  updateDemoForm: FormGroup = this.fb.group({
    [this.DEMO_TITLE_FORM]: [
      this.data.demoDetails.demo_title,
      [Validators.required],
    ],
    [this.DEMO_GROUP_EMAIL_FORM]: [
      this.data.demoDetails.demo_user_group_email,
      [Validators.required, Validators.email],
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
    [this.APP_LINKS_ARRAY_FORM]: this.fb.array(
      this.existingAppLinksPairGroup(),
    ),
    [this.DEMO_SUMMARY_FORM]: [this.data.demoDetails.demo_summary || ''],
  });

  existingAppLinksPairGroup(): FormGroup[] {
    const formGroup: FormGroup[] = [];
    if (this.data.demoDetails?.artifact_links !== null) {
      this.data.demoDetails.artifact_links.forEach((item) => {
        formGroup.push(
          this.fb.group({
            [this.APP_LINK_TITLE_FORM]: [item.title, Validators.required],
            [this.APP_LINK_VALUE_FORM]: [
              item.url,
              [Validators.required, Validators.pattern(DEMO_URL_VALIDATION)],
            ],
            [this.IS_CLICKABLE_FORM]: [item.is_clickable || false],
          }),
        );
      });
    }

    return formGroup!;
  }
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

  ngOnInit(): void {
    this.adminApplications.update(() => this.data.application);
    this.featureLicenseApp.update(
      () => this.data.demoDetails.feature_license_app,
    );
    this.organizationUnit.update(() => this.data.organizationUnit);
    this.getDemoApplications(this.data.demoDetails.applicationIds);
  }

  ngAfterViewInit(): void {
    const initialSummary = this.data.demoDetails.demo_summary || '';
    const editor = this.summaryEditor()?.nativeElement;
    if (editor && initialSummary) {
      editor.innerHTML = initialSummary;
    }
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
    this.updateDemoForm.get(this.DEMO_SUMMARY_FORM)?.setValue(html, { emitEvent: false });
  }

  get appLinksFieldsPairs(): FormArray {
    return this.updateDemoForm.get(this.APP_LINKS_ARRAY_FORM) as FormArray;
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
    const payload: UpdateDemoRequest = {
      demo_title:
        this.updateDemoForm
          .get(this.DEMO_TITLE_FORM)
          ?.value?.toString()
          ?.trim() || '',
      demo_user_group_email:
        this.updateDemoForm
          .get(this.DEMO_GROUP_EMAIL_FORM)
          ?.value?.toString()
          ?.trim() || '',
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
      artifact_links: artifactsLinks,
      demo_summary:
        this.updateDemoForm.get(this.DEMO_SUMMARY_FORM)?.value?.trim() || '',
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
