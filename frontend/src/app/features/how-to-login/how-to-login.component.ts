import { Component, Input, ViewChild } from '@angular/core';
import {
  MatTabChangeEvent,
  MatTabGroup,
  MatTabsModule,
} from '@angular/material/tabs';
import { NewUserComponent } from '../new-user/new-user.component';
import { ExisitingUserComponent } from '../exisiting-user/exisiting-user.component';
import { HowToReserveLicensesComponent } from '../how-to-reserve-licenses/how-to-reserve-licenses.component';
import { DemoDetails } from '../../core/models/demo-details.model';

@Component({
  selector: 'app-how-to-login',
  imports: [
    MatTabsModule,
    NewUserComponent,
    ExisitingUserComponent,
    HowToReserveLicensesComponent,
  ],
  templateUrl: './how-to-login.component.html',
  styleUrl: './how-to-login.component.scss',
})
export class HowToLoginComponent {
  @Input() demoDetails!: DemoDetails;
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
  selectedIndex = 0;

  onTabChange(event: MatTabChangeEvent): void {
    this.selectedIndex = event.index;
  }
}
