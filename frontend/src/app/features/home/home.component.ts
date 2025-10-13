import { Component, signal } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { HomeItems } from './home.enums';
import { LandingPage } from '../landing/landing.page';
import { UserDetailsComponent } from '../user-details/user-details.component';
import { UserAppLinksComponent } from '../user-app-links/user-app-links.component';
import { SignupUserComponent } from '../signup-user/signup-user.component';

export interface HomeMenuItems {
  id: number;
  name: string;
  isSelected: boolean;
  type: HomeItems;
}

@Component({
  selector: 'app-home',
  imports: [
    MatSidenavModule,
    LandingPage,
    UserDetailsComponent,
    UserAppLinksComponent,
    SignupUserComponent,
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
      name: 'Application Links',
      isSelected: true,
      type: HomeItems.APPLICATION_LINKS,
    },
    {
      id: 2,
      name: 'License Reservation',
      isSelected: false,
      type: HomeItems.LICENSE_RESERVATION,
    },
    {
      id: 3,
      name: 'User Profile',
      isSelected: false,
      type: HomeItems.USER_PROFILE,
    },
    {
      id: 4,
      name: 'How To Login IN',
      isSelected: false,
      type: HomeItems.HOW_TO_LOGIN_IN,
    },
  ];

  onItemClicked(type: HomeItems) {
    this.menuItemType.set(type);
    this.homeMenuItems = this.homeMenuItems.map((item) => {
      return { ...item, isSelected: item.type === type };
    });
  }
}
