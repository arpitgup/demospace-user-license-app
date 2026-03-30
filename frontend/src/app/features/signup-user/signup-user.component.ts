import { Component, inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { trigger, style, transition, animate } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { UserCreationService } from '../../core/services/user-creation.service';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialog } from '../../shared/dialogs/error-dialog/error-dialog';
import { DemoDetails } from '../../core/models/demo-details.model';
import { CreateUserRequest } from '../../core/models/create-user-request.model';
import { LoaderService } from '../../core/services/loading.service';
import { INVALID_DEMO_ID_MESSAGE } from '../../shared/constants/error.constants';
import { UserService } from '../../core/services/user.service';
import { GOOGLE_EMAIL_DOMAIN } from '../../shared/constants/domain.constants';
import { logInfo } from '../../../utilities/utils';
import {
  QUERY_DEMO_ID,
  SESSIONS_DEMO_ID,
} from '../../shared/constants/session.constants';

@Component({
  selector: 'app-signup-user',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatButtonModule,
  ],
  templateUrl: './signup-user.component.html',
  styleUrl: './signup-user.component.scss',
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)', opacity: 0 }),
        animate(
          '1s cubic-bezier(0.68,-0.55,0.27,1.55)',
          style({ transform: 'translateY(0)', opacity: 1 }),
        ),
      ]),
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate(
          '1s cubic-bezier(0.68,-0.55,0.27,1.55)',
          style({ transform: 'translateY(0)', opacity: 1 }),
        ),
      ]),
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('1s 1s ease-in', style({ opacity: 1 })),
      ]),
    ]),
  ],
})
export class SignupUserComponent implements OnInit {
  readonly router = inject(Router);
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private userCreationService = inject(UserCreationService);
  private loaderService = inject(LoaderService);
  private dialog = inject(MatDialog);
  readonly FIRST_NAME_FORM = 'firstName';
  readonly LAST_NAME_FORM = 'lastName';
  private activeRoute = inject(ActivatedRoute);
  demoId: string = '';
  ngOnInit() {
    this.activeRoute.queryParams.subscribe((params) => {
      this.demoId =
        params[QUERY_DEMO_ID] || sessionStorage.getItem(SESSIONS_DEMO_ID) || '';
      logInfo('signUpDemoId=', this.demoId);
    });
  }
  createUserForm: FormGroup = this.fb.group({
    [this.FIRST_NAME_FORM]: [
      '',
      [Validators.required, Validators.pattern('^[a-zA-Z]+$')],
    ],
    [this.LAST_NAME_FORM]: [
      '',
      [Validators.required, Validators.pattern('^[a-zA-Z]+$')],
    ],
  });

  onSignUp() {
    sessionStorage.setItem('userEmail', this.userService.userEmailInfo());
    if (this.createUserForm.invalid) {
      return;
    }
    if (this.demoId === '') {
      this.showErrorDialog(INVALID_DEMO_ID_MESSAGE);
      return;
    }
    this.loaderService.show();
    this.userCreationService.getDemoDetails(this.demoId).subscribe({
      next: (res) => {
        this.callCreateUserApi(res);
      },
      error: () => {
        this.loaderService.hide();
        this.showErrorDialog('Unable to fetch demo details. Please try again');
      },
    });
  }
  callCreateUserApi(res: DemoDetails) {
    const pimaryEmail = sessionStorage.getItem('userEmail') ?? '';
    const secondaryEmail = pimaryEmail.replace(/@.*/, GOOGLE_EMAIL_DOMAIN);
    const createUserRequest: CreateUserRequest = {
      primary_email: sessionStorage.getItem('userEmail') ?? '',
      secondary_email: secondaryEmail,
      first_name: this.createUserForm.get(this.FIRST_NAME_FORM)?.value ?? '',
      last_name: this.createUserForm.get(this.LAST_NAME_FORM)?.value ?? '',
      costCenter: res.representative_profile.cost_centre,
      jobTitle: res.representative_profile.rep_role,
      department: res.representative_profile.rep_department,
      orgUnitPath: res.organization_unit,
      demoName: res.demo_title,
      managerEmail: res.representative_profile.manager_email,
    };
    this.userCreationService.createUser(createUserRequest).subscribe({
      next: () => {
        this.router.navigateByUrl(`?demoID=${this.demoId}`, {
          replaceUrl: true,
        });
        logInfo('signUpRedirectionDemoId=', this.demoId);
        this.loaderService.hide();
      },
      error: (err) => {
        this.loaderService.hide();
        this.showErrorDialog(
          err?.error?.detail || 'Something went wrong. Please try again',
        );
      },
    });
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
