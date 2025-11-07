import { Component, inject, OnInit, signal } from '@angular/core';
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
import { LoaderService } from '../../../core/services/loading.service';
import { MatDialog } from '@angular/material/dialog';
import { Application } from '../../../core/models/application.model';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckbox } from '@angular/material/checkbox';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import { AdminService } from '../../../core/services/admin.service';

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
    MatCheckbox
  ],
  templateUrl: './admin-add-new-demo.component.html',
  styleUrl: './admin-add-new-demo.component.scss',
})
export class AdminAddNewDemoComponent implements OnInit {
  private fb = inject(FormBuilder);
  readonly loaderService = inject(LoaderService);
  readonly adminService = inject(AdminService);
  readonly dialog = inject(MatDialog);
  readonly DEMO_ID_FORM = 'demo_id_form';
  readonly DEMO_TITLE_FORM = 'demo_title_form';
  readonly DEMO_GROUP_EMAIL_FORM = 'demo_group_email_form';
  readonly GEMINI_ENTERPRISE_APP_LINK_FORM = 'gemini_enterprise_app_link_form';
  readonly DRIVE_FOLDER_LINK_FORM = 'drive_folder_link_form';
  readonly DEMO_APPLICATION_FORM = 'demo_application_form';
  readonly featureLicenseApp = signal<boolean>(false);
  readonly selectedIds = signal<number[]>([]);
  readonly adminApplications = signal<Application[]>([]);
  readonly selectedApplications = signal<Application[]>([]);
  readonly applicationErrorMessage = signal<string>('');
  public isLicenseReservation = signal<boolean>(false);
  addDemoForm: FormGroup = this.fb.group({
    [this.DEMO_ID_FORM]: ['', Validators.required],
    [this.DEMO_TITLE_FORM]: ['', [Validators.required]],
    [this.DEMO_GROUP_EMAIL_FORM]: ['', Validators.required],
    [this.GEMINI_ENTERPRISE_APP_LINK_FORM]: ['', Validators.required],
    [this.DRIVE_FOLDER_LINK_FORM]: ['', Validators.required],
    [this.DEMO_APPLICATION_FORM]: ['', Validators.required],
  });

  ngOnInit(): void {
    this.fetchAllAdminApplications();
  }
  fetchAllAdminApplications() {
    this.loaderService.show();
    this.adminService.fetchAllApplications().subscribe({
      next: (res) => {
        this.applicationErrorMessage.set('');
        this.loaderService.hide();
        this.adminApplications.set(res);
      },
      error: (error) => {
        this.loaderService.hide();
        this.applicationErrorMessage.set(
          error?.error?.detail || 'Something went wrong'
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
    this.isLicenseReservation.set(isChecked);
  }
}
