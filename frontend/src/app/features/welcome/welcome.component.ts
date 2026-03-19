import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { trigger, style, transition, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { DEMO_PAGE_URL } from '../../shared/constants/links.contants';
import { logInfo } from '../../../utilities/utils';

@Component({
  standalone: true,
  selector: 'app-welcome',
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
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
export class WelcomeComponent {
  readonly router = inject(Router);
  private activeRoute = inject(ActivatedRoute);
  goDemoUrl = DEMO_PAGE_URL;
  onStartSignUp() {
    const demoId = this.activeRoute.snapshot.queryParams['demoID'] || '';
    logInfo('welcomeSignUpDemoId=', demoId);
    this.router.navigateByUrl(`/signup?demoID=${demoId}`, { replaceUrl: true });
  }
  getDemoGuideLink() {
    const demoId = this.activeRoute.snapshot.queryParams['demoID'] || '';
    logInfo('welcomeDemoGuideLinkDemoId=', demoId);
    return `${this.goDemoUrl}/demo/${demoId}`;
  }
}
