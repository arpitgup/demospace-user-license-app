import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';

interface Reservation {
  date: string;
  apps: string[];
  status: 'Current' | 'Upcoming';
}

@Component({
  selector: 'app-reservation-table',
  templateUrl: './reservation-table.component.html',
  styleUrls: ['./reservation-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTableModule, MatButtonModule, MatCheckboxModule],
  host: { class: 'reservation-table-wrapper' },
})
export class ReservationTableComponent {
  readonly reservations = signal<Reservation[]>([
    { date: '2025-08-16 to 2025-08-22', apps: ['ServiceNow', 'Slack', 'Jira'], status: 'Current' },
    { date: '2025-09-15 to 2025-09-22', apps: ['ServiceNow', 'Slack', 'Jira'], status: 'Upcoming' },
    { date: '2025-09-25 to 2025-10-02', apps: ['ServiceNow', 'Slack', 'Jira'], status: 'Upcoming' },
    { date: '2025-10-05 to 2025-10-12', apps: ['ServiceNow', 'Slack', 'Jira'], status: 'Upcoming' },
  ]);

  onView(reservation: Reservation) {
    console.log('Viewing reservation:', reservation);
  }

  onCancel(reservation: Reservation) {
    console.log('Cancelling reservation:', reservation);
  }
}
