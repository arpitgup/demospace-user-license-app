import { Component, signal } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MenuItems } from './admin-home.enums';
import { AdminReservation } from '../admin-reservation/admin-reservation';
import { AdminDowntimeComponent } from '../admin-downtime/admin-downtime.component';
import { AdminBotsComponent } from '../admin-bots/admin-bots.component';
import { AdminApplicationsComponent } from '../admin-applications/admin-applications.component';

export interface AdminMenuItems {
  id: number;
  name: string;
  icon: string;
  isSelected: boolean;
  type: MenuItems;
}
@Component({
  selector: 'app-admin-home',
  imports: [
    MatSidenavModule,
    AdminReservation,
    AdminBotsComponent,
    AdminDowntimeComponent,
    AdminApplicationsComponent,
  ],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.scss',
})
export class AdminHomeComponent {
  menuItemType = signal(MenuItems.RESERVATION_OVERVIEW);
  menuItemsEnums = MenuItems;
  adminMenuItems: AdminMenuItems[] = [
    {
      id: 1,
      icon: 'assets/svgs/ic_nav_calendar.svg',
      name: 'Reservation Overview',
      isSelected: true,
      type: MenuItems.RESERVATION_OVERVIEW,
    },
    {
      id: 2,
      icon: 'assets/svgs/ic_nav_bot.svg',
      name: 'Bot Activity',
      isSelected: false,
      type: MenuItems.BOT_ACTIVITY,
    },
    {
      id: 3,
      icon: 'assets/svgs/ic_nav_settings.svg',
      name: 'Application Details',
      isSelected: false,
      type: MenuItems.APPLICATION_DETAILS,
    },
    {
      id: 4,
      icon: 'assets/svgs/ic_nav_downTime.svg',
      name: 'Application Downtime',
      isSelected: false,
      type: MenuItems.APPLICATION_DOWNTIME,
    },
  ];

  onItemClicked(type: MenuItems) {
    this.menuItemType.set(type);
    this.adminMenuItems = this.adminMenuItems.map((item) => {
      return { ...item, isSelected: item.type === type };
    });
  }
}
