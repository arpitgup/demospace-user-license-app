import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { HomeItems } from './home.enums';
import { LandingPage } from '../landing/landing.page';
import { UserDetailsComponent } from '../user-details/user-details.component';
import { UserAppLinksComponent } from '../user-app-links/user-app-links.component';
import { MatIconModule } from '@angular/material/icon';
import { UserCreationService } from '../../core/services/user-creation.service';
import { ActivatedRoute } from '@angular/router';
import { catchError, concatMap, of } from 'rxjs';
import { UpdateUserRequest } from '../../core/models/update-user-request.model';
import { AddUserInGroupRequest } from '../../core/models/add-user-in-group-request.model';
import { DemoDetails } from '../../core/models/demo-details.model';
import { isPlatformBrowser } from '@angular/common';
import { IapService } from '../../core/services/iap.service';
import { HomeLoaderComponent } from '../../loaders/home-loader/home-loader.component';
import { ErrorMessage } from '../../shared/components/error-message/error-message';
import { INVALID_DEMO_ID_MESSAGE } from '../../shared/constants/error.constants';
import { BUGANIZER_URL } from '../../shared/constants/links.contants';
import { HowToLoginComponent } from '../how-to-login/how-to-login.component';

export interface HomeMenuItems {
  id: number;
  name: string;
  isSelected: boolean;
  type: HomeItems;
  icon: string;
  url: string;
}

@Component({
  selector: 'app-home',
  imports: [
    MatSidenavModule,
    LandingPage,
    UserDetailsComponent,
    UserAppLinksComponent,
    MatIconModule,
    HomeLoaderComponent,
    ErrorMessage,
    HowToLoginComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  menuItemType = signal(HomeItems.APPLICATION_LINKS);
  menuItemsEnums = HomeItems;
  isLoading = signal<boolean>(true);
  errorMessage = signal<string>('');
  demoDetails = signal<DemoDetails | null>(null);
  private userService = inject(UserCreationService);
  private iapService = inject(IapService);
  private activeRoute = inject(ActivatedRoute);
  userDetails = this.userService.userInfo;
  demoId: string = '';
  private platformId = inject(PLATFORM_ID);
  homeMenuItems: HomeMenuItems[] = [
    {
      id: 1,
      name: 'Home',
      isSelected: true,
      type: HomeItems.APPLICATION_LINKS,
      icon: 'home',
      url: '',
    },
    {
      id: 2,
      name: 'License Reservation',
      isSelected: false,
      type: HomeItems.LICENSE_RESERVATION,
      icon: 'calendar_month',
      url: '',
    },
    {
      id: 3,
      name: 'User Profile',
      isSelected: false,
      type: HomeItems.USER_PROFILE,
      icon: 'person',
      url: '',
    },
    {
      id: 4,
      name: 'How To Login',
      isSelected: false,
      type: HomeItems.HOW_TO_LOGIN_IN,
      icon: 'login',
      url: '',
    },
    {
      id: 5,
      name: 'File a ticket/Feedback',
      isSelected: false,
      type: HomeItems.FILE_A_TICKET,
      icon: 'bug_report_outlined',
      url: '',
    },
  ];

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem('userEmail', this.iapService.userEmailInfo());
      this.activeRoute.queryParams.subscribe((params) => {
        this.demoId = params['demoID'] || '';
        if (this.demoId === '') {
          this.isLoading.update(() => false);
          this.errorMessage.update(() => INVALID_DEMO_ID_MESSAGE);
          return;
        }
        this.callDemoDetailsApi(this.demoId);
      });
    }
  }

  callDemoDetailsApi(demoId: string) {
    this.isLoading.update(() => true);
    of(null)
      .pipe(
        concatMap(() => {
          return this.userService.getDemoDetails(demoId);
        }),

        concatMap((demoDetailsResponse) => {
          this.demoDetails.update(() => demoDetailsResponse);
          const primaryEmail = sessionStorage.getItem('userEmail') ?? '';
          const secondaryEmail = primaryEmail.replace(/-.*/, '@google.com');
          const request: UpdateUserRequest = {
            primary_email: primaryEmail,
            secondary_email: secondaryEmail,
            first_name: this.userService.userInfo()?.first_name ?? '',
            last_name: this.userService.userInfo()?.last_name ?? '',
            costCenter: demoDetailsResponse.representative_profile.cost_centre,
            jobTitle: demoDetailsResponse.representative_profile.rep_role,
            department:
              demoDetailsResponse.representative_profile.rep_department,
            orgUnitPath: '/',
            demoName: demoDetailsResponse.demo_title,
            managerEmail:
              demoDetailsResponse.representative_profile.manager_email,
            employeeID: this.userService.userInfo()?.employeeID ?? '',
          };
          return this.userService.updateUserDetails(request);
        }),

        concatMap(() => {
          const request: AddUserInGroupRequest = {
            group_email: this.demoDetails()?.demo_user_group_email ?? '',
          };
          return this.userService.addUserToGroup(request);
        }),
        catchError((error) => {
          this.errorMessage.update(
            () =>
              error?.error?.detail || 'Something went wrongs. Please try again.'
          );
          return of(null);
        })
      )
      .subscribe({
        next: (finalResponse) => {
          if (finalResponse === null) {
            this.isLoading.update(() => false);
            return;
          }
          this.errorMessage.update(() => '');
          this.isLoading.update(() => false);
          this.updateHomeMenuList(this.demoDetails()?.feature_license_app);
        },
        error: (err) => {
          this.errorMessage.update(
            () =>
              err?.error?.detail || 'Something went wrong. Please try again.'
          );
          this.isLoading.update(() => false);
        },
      });
  }
  updateHomeMenuList(feature_license_app: string | undefined) {
    if ((feature_license_app || false) === false) {
      this.homeMenuItems = this.homeMenuItems.filter(
        (item) => item.type !== HomeItems.LICENSE_RESERVATION
      );
    }
  }

  onItemClicked(type: HomeItems) {
    if (type === this.menuItemsEnums.FILE_A_TICKET) {
      const feedbackUrl = `${BUGANIZER_URL}&title=UserApp%20Feedback%20:%20${
        this.demoDetails()?.demo_title?.replaceAll(' ', '%20') || ''
      }&assignee=cloud-demo-platform-support@google.com&cc=${
        this.userDetails()?.secondary_email
      }&customFields=1232889%3A${this.demoDetails()?.demo_id || ''}`;
      window.open(feedbackUrl, '_blank', 'noopener noreferrer');
      return;
    }
    this.menuItemType.set(type);
    this.homeMenuItems = this.homeMenuItems.map((item) => {
      return { ...item, isSelected: item.type === type };
    });
  }

  onRetryCall() {
    this.errorMessage.update(() => '');
    const demoId = this.activeRoute.snapshot.queryParams['demoID'] || '';
    if (demoId === '') {
      this.errorMessage.update(() => INVALID_DEMO_ID_MESSAGE);
      return;
    }
    this.callDemoDetailsApi(demoId);
  }

  goProfileSection() {
    console.log("profile");
    this.menuItemType.set(HomeItems.USER_PROFILE);
    this.homeMenuItems = this.homeMenuItems.map((item) => {
      return { ...item, isSelected: item.type === HomeItems.USER_PROFILE };
    });
  }
}
