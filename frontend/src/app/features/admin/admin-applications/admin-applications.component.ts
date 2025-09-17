import { Component, ViewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  MatTabChangeEvent,
  MatTabGroup,
  MatTabsModule,
} from '@angular/material/tabs';

@Component({
  selector: 'app-admin-applications',
  imports: [
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    ReactiveFormsModule,
  ],
  templateUrl: './admin-applications.component.html',
  styleUrl: './admin-applications.component.scss',
})
export class AdminApplicationsComponent {
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
  selectedIndex = 0;

  onTabChange(event: MatTabChangeEvent): void {
    this.selectedIndex = event.index;
  }

  botCreation() {
    this.tabGroup.selectedIndex = 0;
  }
}
