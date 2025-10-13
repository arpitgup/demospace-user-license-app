import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { trigger, style, transition, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  standalone: true,
  selector: 'app-welcome',
  imports: [CommonModule, MatButtonModule,MatIconModule],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
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
export class WelcomeComponent {}
