import { Component, ViewChild } from '@angular/core';
import {
  MatTabChangeEvent,
  MatTabGroup,
  MatTabsModule,
} from '@angular/material/tabs';

@Component({
  selector: 'app-how-to-login',
  imports: [MatTabsModule],
  templateUrl: './how-to-login.component.html',
  styleUrl: './how-to-login.component.scss',
})
export class HowToLoginComponent {
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
  selectedIndex = 0;

  onTabChange(event: MatTabChangeEvent): void {
    this.selectedIndex = event.index;
  }
}
