import { animate, style, transition, trigger } from '@angular/animations';
import { Component, inject, Input, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DemoDetails } from '../../core/models/demo-details.model';
import { UserCreationService } from '../../core/services/user-creation.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { CHAT_SPACE_URL, DEMO_PAGE_URL } from '../../shared/constants/links.contants';
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
          style({ transform: 'translateY(0)', opacity: 1 })
        ),
      ]),
    ]),
    trigger('slideInFromLeft', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate(
          '1s cubic-bezier(0.68,-0.55,0.27,1.55)',
          style({ transform: 'translateX(0)', opacity: 1 })
        ),
      ]),
    ]),
    trigger('slideInFromRight', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate(
          '1s cubic-bezier(0.68,-0.55,0.27,1.55)',
          style({ transform: 'translateX(0)', opacity: 1 })
        ),
      ]),
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate(
          '1s cubic-bezier(0.68,-0.55,0.27,1.55)',
          style({ transform: 'translateY(0)', opacity: 1 })
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
  private userService = inject(UserCreationService);
  userDetails = this.userService.userInfo;
  public copyGeminiSuccess = signal(false);
  public copyDriveSuccess = signal(false);
  public showPassword = signal(false);
  private clipboard = inject(Clipboard);
  public passwordMasked = signal<string>(
    '•'.repeat((this.userDetails()?.password || '').length)
  );
  goDemoUrl=DEMO_PAGE_URL;
  chatSpaceUrl=CHAT_SPACE_URL;

  copyText(link: string, isGemini: boolean) {
    const successful = this.clipboard.copy(link);
    if (successful) {
      if (isGemini) {
        this.copyGeminiSuccess.set(true);
        setTimeout(() => this.copyGeminiSuccess.set(false), 2000);
      } else {
        this.copyDriveSuccess.set(true);
        setTimeout(() => this.copyDriveSuccess.set(false), 2000);
      }
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
          '•'.repeat((this.userDetails()?.password || '').length)
        );
      },
      error: (error) => {},
    });
  }

  updateShowPasswordValue() {
    this.showPassword.update(() => !this.showPassword());
  }
}
