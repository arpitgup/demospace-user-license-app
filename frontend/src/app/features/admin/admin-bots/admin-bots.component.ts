import { Component } from '@angular/core';
import { ADMIN_BOTS_CONSTANTS } from './admin-bots.constants';
import { MatTabChangeEvent, MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { AdminBotsTableComponent } from '../admin-bots-table/admin-bots-table.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AdminCreateBotComponent } from '../admin-create-bot/admin-create-bot.component';

@Component({
  selector: 'app-admin-bots',
  imports: [
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    AdminBotsTableComponent,
    ReactiveFormsModule,
    AdminCreateBotComponent
  ],
  templateUrl: './admin-bots.component.html',
  styleUrl: './admin-bots.component.scss',
})
export class AdminBotsComponent {
  readonly adminBotsConstants = ADMIN_BOTS_CONSTANTS;

  selectedIndex = 0;
  readonly searchBotControl = new FormControl<string>('');

  onTabChange(event: MatTabChangeEvent): void {
    this.selectedIndex = event.index;
  }
}
