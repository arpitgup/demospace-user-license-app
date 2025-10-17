import { Component, signal } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { HomeItems } from './home.enums';
import { LandingPage } from '../landing/landing.page';
import { UserDetailsComponent } from '../user-details/user-details.component';
import { UserAppLinksComponent } from '../user-app-links/user-app-links.component';
import { MatIconModule } from '@angular/material/icon';

export interface HomeMenuItems {
  id: number;
  name: string;
  isSelected: boolean;
  type: HomeItems;
  icon:string;
}

@Component({
  selector: 'app-home',
  imports: [
    MatSidenavModule,
    LandingPage,
    UserDetailsComponent,
    UserAppLinksComponent,
    MatIconModule
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  menuItemType = signal(HomeItems.APPLICATION_LINKS);
  menuItemsEnums = HomeItems;
  homeMenuItems: HomeMenuItems[] = [
    {
      id: 1,
      name: 'Home',
      isSelected: true,
      type: HomeItems.APPLICATION_LINKS,
      icon:'home',
    },
    {
      id: 2,
      name: 'License Reservation',
      isSelected: false,
      type: HomeItems.LICENSE_RESERVATION,
       icon:'calendar_month',
    },
    {
      id: 3,
      name: 'User Profile',
      isSelected: false,
      type: HomeItems.USER_PROFILE,
       icon:'person',
    },
    {
      id: 4,
      name: 'How To Login IN',
      isSelected: false,
      type: HomeItems.HOW_TO_LOGIN_IN,
      icon:'login'
    },
  ];

  onItemClicked(type: HomeItems) {
    this.menuItemType.set(type);
    this.homeMenuItems = this.homeMenuItems.map((item) => {
      return { ...item, isSelected: item.type === type };
    });
  }
}
