import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ReservationTableComponent } from '../../shared/components/reservation-table/reservation-table.component';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckbox } from '@angular/material/checkbox';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTabsModule, MatCheckbox, ReservationTableComponent],
  host: {
    class: 'landing-page-container',
  },
})
export class LandingPage {}
