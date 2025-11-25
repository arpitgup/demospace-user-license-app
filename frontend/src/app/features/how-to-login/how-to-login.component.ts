import { Component, Input, OnInit, ViewChild } from '@angular/core';
import {
  MatTabChangeEvent,
  MatTabGroup,
  MatTabsModule,
} from '@angular/material/tabs';
import { NewUserComponent } from '../new-user/new-user.component';
import { HowToReserveLicensesComponent } from '../how-to-reserve-licenses/how-to-reserve-licenses.component';
import { DemoDetails } from '../../core/models/demo-details.model';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-how-to-login',
  imports: [
    MatTabsModule,
    NewUserComponent,
    HowToReserveLicensesComponent,
    MatTooltipModule,
  ],
  templateUrl: './how-to-login.component.html',
  styleUrl: './how-to-login.component.scss',
})
export class HowToLoginComponent implements OnInit {
  @Input() demoDetails!: DemoDetails;
  @Input() redirectHowToReserveLicense!: boolean;
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
  selectedIndex = 0;

  ngOnInit(): void {
    this.selectedIndex = this.redirectHowToReserveLicense === true ? 1 : 0;
  }

  onTabChange(event: MatTabChangeEvent): void {
    this.selectedIndex = event.index;
  }
}
