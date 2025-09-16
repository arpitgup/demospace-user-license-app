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
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Application } from '../../../core/models/application.model';
import { MatIconModule } from '@angular/material/icon';
import { AdminService } from '../../../core/services/admin.service';
import { MatCheckbox } from '@angular/material/checkbox';
import { LoaderService } from '../../../core/services/loading.service';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import {
  BotDetails,
  CreateBotRequest,
} from '../../../core/models/create-bot-request.model';
import { SuccessDialog } from '../../../shared/dialogs/success-dialog/success-dialog';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialog } from '../../../shared/dialogs/error-dialog/error-dialog';
import { BotService } from '../../../core/services/bot.service';

@Component({
  selector: 'app-admin-create-bot',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatChipsModule,
    MatIconModule,
    MatCheckbox,
    ErrorMessage,
  ],
  templateUrl: './admin-create-bot.component.html',
  styleUrl: './admin-create-bot.component.scss',
})
export class AdminCreateBotComponent implements OnInit{
  readonly adminService = inject(AdminService);
  readonly botService = inject(BotService);
  private fb = inject(FormBuilder);
  readonly loaderService = inject(LoaderService);
  public isAdmin = signal<boolean>(false);
  readonly BOT_NAME_FORM = 'botName';
  readonly BOT_EMAIL_FORM = 'botEmail';
  readonly BOT_APPLICATIONS_FORM = 'botApplications';

  createBotForm: FormGroup = this.fb.group({
    [this.BOT_NAME_FORM]: ['', Validators.required],
    [this.BOT_EMAIL_FORM]: ['', [Validators.required, Validators.email]],
    [this.BOT_APPLICATIONS_FORM]: ['', Validators.required],
  });

  readonly selectedIds = signal<number[]>([]);
  readonly adminApplications = signal<Application[]>([]);
  readonly selectedApplications = signal<Application[]>([]);
  readonly applicationErrorMessage = signal<string>('');
  private dialog = inject(MatDialog);
  @Output() botCreationSuccess = new EventEmitter();

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
        this.updateApplicationAvailability();
      },
      error: (error) => {
        this.loaderService.hide();
        this.applicationErrorMessage.set(
          error?.error?.detail || 'Something went wrong'
        );
      },
    });
  }

  updateApplicationAvailability() {
    this.createBotForm
      .get(this.BOT_APPLICATIONS_FORM)
      ?.patchValue(this.selectedApplications());
    const filteredApplications = this.adminApplications().map((element) => ({
      ...element,
      isEnabled:
        (element.licenseAssignedToBots ?? 0) < (element.licenseCount ?? 0) &&
        !this.selectedApplications().some((app) => app.id === element.id)
          ? true
          : false,
      remainingLicenseCount:
        (element.licenseCount ?? 0) - (element.licenseAssignedToBots ?? 0),
    }));
    this.adminApplications.set(filteredApplications);
  }

  addApp(app: Application): void {
    this.selectedApplications().push(app);
    this.adminApplications.set(
      this.adminApplications().map((item) => {
        if (app.id === item.id) {
          item.licenseAssignedToBots = (item.licenseAssignedToBots ?? 0) + 1;
        }
        return item;
      })
    );
    this.updateApplicationAvailability();
  }

  removeApp(app: Application) {
    this.selectedApplications.set(
      this.selectedApplications().filter((item) => item.id != app.id)
    );
    this.adminApplications.set(
      this.adminApplications().map((item) => {
        if (app.id === item.id) {
          item.licenseAssignedToBots = (item.licenseAssignedToBots ?? 0) - 1;
        }
        return item;
      })
    );
    this.updateApplicationAvailability();
  }

  onSelectAdminReserved(isChecked: boolean) {
    this.isAdmin.set(isChecked);
  }

  onConfirm(): void {
    if (this.createBotForm.invalid) {
      this.createBotForm.markAllAsTouched();
      return;
    }
    const applicationsIds = this.selectedApplications().map((item) => item.id);
    const botDetais: BotDetails = {
      name: this.createBotForm.get(this.BOT_EMAIL_FORM)?.value ?? '',
      email: this.createBotForm.get(this.BOT_EMAIL_FORM)?.value ?? '',
      is_admin: this.isAdmin(),
      application_ids: applicationsIds,
    };
    const createBotRequest: CreateBotRequest = { bots: [botDetais] };
    this.callCreateBot(createBotRequest);
  }
  callCreateBot(createBotRequest: CreateBotRequest) {
    this.loaderService.show();
    this.botService.createBot(createBotRequest).subscribe({
      next: () => {
        this.loaderService.hide();
        this.showSuccessDialog();
      },
      error: (err) => {
        this.loaderService.hide();
        this.showErrorDialog(err.error.detail || 'Something went wrong');
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
        message: 'Bot successfully added',
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.botService.refreshBotsState.set(true);
        this.botCreationSuccess.emit();
      }
    });
  }

  onCancel(): void {
    this.botCreationSuccess.emit();
  }

  onRetryCall() {
    this.fetchAllAdminApplications();
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
