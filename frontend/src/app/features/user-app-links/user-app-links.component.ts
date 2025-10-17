import { animate, style, transition, trigger } from '@angular/animations';
import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

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
  copyText() {}
}
