import { animate, style, transition, trigger } from '@angular/animations';
import {
  ChangeDetectorRef,
  Component,
  effect,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DemoDetails } from '../../core/models/demo-details.model';
import { UserCreationService } from '../../core/services/user-creation.service';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  CHAT_SPACE_URL,
  DEMO_PAGE_URL,
  DEMOSPACEINFO_LINK,
} from '../../shared/constants/links.contants';
import { MatDialog } from '@angular/material/dialog';
import { SuccessDialog } from '../../shared/dialogs/success-dialog/success-dialog';
import { ErrorDialog } from '../../shared/dialogs/error-dialog/error-dialog';
import { ArtifactsLinks } from '../../core/models/artifacts_link.model';
import { ReservationService } from '../../core/services/reservation.service';
@Component({
  selector: 'app-user-app-links',
  imports: [MatIconModule, MatCardModule],
  templateUrl: './user-app-links.component.html',
  styleUrl: './user-app-links.component.scss',
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
    trigger('slideInFromLeft', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate(
          '1s cubic-bezier(0.68,-0.55,0.27,1.55)',
          style({ transform: 'translateX(0)', opacity: 1 }),
        ),
      ]),
    ]),
    trigger('slideInFromRight', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate(
          '1s cubic-bezier(0.68,-0.55,0.27,1.55)',
          style({ transform: 'translateX(0)', opacity: 1 }),
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
export class UserAppLinksComponent {
  @Input() demoDetails!: DemoDetails;
  @Output() redirectHowToLogin = new EventEmitter();
  private userService = inject(UserCreationService);
  private cdr = inject(ChangeDetectorRef);
  userDetails = this.userService.userInfo;
  public copyPasswordSuccess = signal(false);
  public showPassword = signal(false);
  private clipboard = inject(Clipboard);
  public passwordMasked = signal<string>(
    '•'.repeat((this.userDetails()?.password || '').length),
  );
  goDemoUrl = DEMO_PAGE_URL;
  chatSpaceUrl = CHAT_SPACE_URL;
  demospaceInfoUrl = DEMOSPACEINFO_LINK;
  private reservationService = inject(ReservationService);
  private readonly reservationsSig = this.reservationService;

  DEFAULT_DEMO_SUMMARY =
    '<p><a href="https://cloud-demo-hub.corp.google.com/demo/{demo_id}" title="https://cloud-demo-hub.corp.google.com/demo/{demo_id}" target=\"_blank\">Gemini Enterprise - {demo_id}</a> showcases 1st Party (Google Workspace) and 3rd Party search and summarization results.</p><ul><li><p>Google Licenses: This application allows Googlers to create demo profiles within a dedicated environment for showcasing Gemini Enterprise. Demo users are issued Google Workspace Enterprise Plus and Gemini Enterprise Plus licenses. See How to login section for more.</p></li></ul><ul><li><p>For 3rd party resources: The License reservation feature (see left menu) allows users to reserve Third Party licenses for this demo. Reservations are only needed to SSO into the third party platform(s) i.e. reservations are not needed to use this demo. We are actively working on adding more platform access. See demo guide for more.</p></li></ul><ul><li><p>Chrome Profile: Once you are in the demo environment, create a Chrome profile for your demo user for easy access. Please see the latest Demo Guide for more.</p></li></ul>';
  private dialog = inject(MatDialog);
  copyText(artifactLink: ArtifactsLinks) {
    const successful = this.clipboard.copy(artifactLink.url);
    if (successful) {
      artifactLink.copyUrl = true;
      setTimeout(() => {
        artifactLink.copyUrl = false;
        this.cdr.detectChanges();
      }, 2000);
    }
  }

  constructor() {
    this.listenAppConfig();
  }

  private applyDefaultSummary(): void {
    if (!this.demoDetails) return;
    this.DEFAULT_DEMO_SUMMARY = this.DEFAULT_DEMO_SUMMARY.replaceAll(
      '{demo_id}',
      this.demoDetails.demo_id || '',
    );

    if (
      this.demoDetails.demo_summary == null ||
      (this.demoDetails.demo_summary || '').trim().length <= 0
    ) {
      this.demoDetails.demo_summary = this.DEFAULT_DEMO_SUMMARY;
    }
    console.log('app-config', this.demoDetails.demo_summary);
  }

  listenAppConfig() {
    effect(() => {
      const appConfig = this.reservationsSig.appConfigData();
      this.DEFAULT_DEMO_SUMMARY =
        appConfig?.defaultDemoSummary || this.DEFAULT_DEMO_SUMMARY;
      this.applyDefaultSummary();
    });
  }
  copyPassword(password: string | undefined) {
    const successful = this.clipboard.copy(password ?? '');
    if (successful) {
      this.copyPasswordSuccess.set(true);
      setTimeout(() => this.copyPasswordSuccess.set(false), 2000);
    }
  }

  // listenUserChanges() {
  //   toObservable(this.userService.userInfo).subscribe((value) => {
  //     if (value) {
  //       this.userDetails;
  //     }
  //   });
  // }

  callResetPasswordApi() {
    this.userService.resetUserPassword().subscribe({
      next: () => {
        this.userDetails = this.userService.userInfo;
        this.passwordMasked.update(() =>
          '•'.repeat((this.userDetails()?.password || '').length),
        );
        this.showSuccessDialog();
      },
      error: (error) => {
        this.showErrorDialog(
          error?.error?.detail || 'Something went wrong. Please try again',
        );
      },
    });
  }

  updateShowPasswordValue() {
    this.showPassword.update(() => !this.showPassword());
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
        message: 'Reset password successfully',
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed().subscribe(() => {});
  }

  redirectToHowLogin() {
    this.redirectHowToLogin.emit();
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
