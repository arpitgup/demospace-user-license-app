import { Component, ViewChild } from '@angular/core';
import {
  MatTabChangeEvent,
  MatTabGroup,
  MatTabsModule,
} from '@angular/material/tabs';
import { AdminAddNewDemoComponent } from '../admin-add-new-demo/admin-add-new-demo.component';
import { AdminOnboardDemoTableComponent } from '../../demo/admin-onboard-demo-table/admin-onboard-demo-table.component';

@Component({
  selector: 'app-admin-demo-onboarding',
  imports: [
    MatTabsModule,
    AdminAddNewDemoComponent,
    AdminOnboardDemoTableComponent,
  ],
  templateUrl: './admin-demo-onboarding.component.html',
  styleUrl: './admin-demo-onboarding.component.scss',
})
export class AdminDemoOnboardingComponent {
  selectedIndex = 0;
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
  onTabChange(event: MatTabChangeEvent): void {
    this.selectedIndex = event.index;
  }
  changeTabContent() {
    this.tabGroup.selectedIndex = 1;
  }
   demoOnBoarding() {
    this.tabGroup.selectedIndex = 0;
  }
}
