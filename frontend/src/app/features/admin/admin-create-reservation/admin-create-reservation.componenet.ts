import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { ReservationService } from '../../../core/services/reservation.service';
import { error } from 'console';
import { Application } from '../../../core/models/application.model';
import { isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButton, MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-admin-create-reservation',
  providers: [provideNativeDateAdapter()],
  imports: [
    MatCardModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatDatepickerModule,
    MatTimepickerModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './admin-create-reservation.componenet.html',
  styleUrl: './admin-create-reservation.componenet.scss',
})
export class AdminCreateReservationComponenet implements OnInit {
  private fb = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID);
  private reservationService = inject(ReservationService);
  readonly USER_NAME_FORM = 'userName';
  readonly USER_EMAIL_FORM = 'userEmail';
  applications: Application[] = [];

  createReservationForm: FormGroup = this.fb.group({
    [this.USER_NAME_FORM]: ['', Validators.required],
    [this.USER_EMAIL_FORM]: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.getAllUserApplications();
    }
  }

  getAllUserApplications() {
    this.reservationService.getApplications().subscribe({
      next: (res) => {
        this.applications = res;
      },
      error: (error) => {},
    });
  }
}
