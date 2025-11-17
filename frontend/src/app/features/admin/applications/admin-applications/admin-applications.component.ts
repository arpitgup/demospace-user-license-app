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
import { AdminApplicationTableComponent } from '../admin-application-table/admin-application-table.component';
import { AdminCreateApplicationComponent } from '../admin-create-application/admin-create-application.component';
import { ApplicationsConstants } from '../applications.constants';

@Component({
  selector: 'app-admin-applications',
  imports: [
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    ReactiveFormsModule,
    AdminApplicationTableComponent,
    AdminCreateApplicationComponent,
  ],
  templateUrl: './admin-applications.component.html',
  styleUrl: './admin-applications.component.scss',
})
export class AdminApplicationsComponent {
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
  applicationConstants = ApplicationsConstants;
  selectedIndex = 0;

  onTabChange(event: MatTabChangeEvent): void {
    this.selectedIndex = event.index;
  }

  applicationCreationSuccess() {
    this.tabGroup.selectedIndex = 0;
  }
}
