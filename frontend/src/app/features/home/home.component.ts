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
import { HomeLoaderComponent } from '../../loaders/home-loader/home-loader.component';
import { ErrorMessage } from '../../shared/components/error-message/error-message';
import { INVALID_DEMO_ID_MESSAGE } from '../../shared/constants/error.constants';
import { BUGANIZER_URL } from '../../shared/constants/links.contants';
import { HowToLoginComponent } from '../how-to-login/how-to-login.component';
import { DemoOnBoardingEnum } from '../../enums/admin-demo-onboarding.enums';
import { UserService } from '../../core/services/user.service';
import { GOOGLE_EMAIL_DOMAIN } from '../../shared/constants/domain.constants';
import { logInfo } from '../../../utilities/utils';
import {
  QUERY_DEMO_ID,
  SESSIONS_DEMO_ID,
} from '../../shared/constants/session.constants';
import { ReservationService } from '../../core/services/reservation.service';

export interface HomeMenuItems {
  id: number;
  name: string;
  isSelected: boolean;
  type: HomeItems;
  icon: string;
  url: string;
  redirctToReserveLicense: boolean;
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
  private userCreationService = inject(UserCreationService);
  private reservationService = inject(ReservationService);
  private userService = inject(UserService);
  private activeRoute = inject(ActivatedRoute);
  userDetails = this.userCreationService.userInfo;
  demoId: string = '';
  private platformId = inject(PLATFORM_ID);
  demoOnBoardingStatus = DemoOnBoardingEnum;
  homeMenuItems: HomeMenuItems[] = [
    {
      id: 1,
      name: 'Home',
      isSelected: true,
      type: HomeItems.APPLICATION_LINKS,
      icon: 'home',
      url: '',
      redirctToReserveLicense: false,
    },
    {
      id: 2,
      name: 'License Reservation',
      isSelected: false,
      type: HomeItems.LICENSE_RESERVATION,
      icon: 'calendar_month',
      url: '',
      redirctToReserveLicense: false,
    },
    {
      id: 3,
      name: 'User Profile',
      isSelected: false,
      type: HomeItems.USER_PROFILE,
      icon: 'person',
      url: '',
      redirctToReserveLicense: false,
    },
    {
      id: 4,
      name: 'How To Login',
      isSelected: false,
      type: HomeItems.HOW_TO_LOGIN_IN,
      icon: 'login',
      url: '',
      redirctToReserveLicense: false,
    },
    {
      id: 5,
      name: 'File a ticket/Feedback',
      isSelected: false,
      type: HomeItems.FILE_A_TICKET,
      icon: 'bug_report_outlined',
      url: '',
      redirctToReserveLicense: false,
    },
  ];

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem('userEmail', this.userService.userEmailInfo());
      this.activeRoute.queryParams.subscribe((params) => {
        this.demoId =
          params[QUERY_DEMO_ID] ||
          sessionStorage.getItem(SESSIONS_DEMO_ID) ||
          '';
        logInfo('homePageDemoId=', this.demoId);
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
          return this.userCreationService.getDemoDetails(demoId);
        }),

        concatMap((demoDetailsResponse) => {
          this.demoDetails.update(() => demoDetailsResponse);
          const primaryEmail = sessionStorage.getItem('userEmail') ?? '';
          const secondaryEmail = primaryEmail.replace(
            /@.*/,
            GOOGLE_EMAIL_DOMAIN,
          );
          const request: UpdateUserRequest = {
            primary_email: primaryEmail,
            secondary_email: secondaryEmail,
            first_name: this.userCreationService.userInfo()?.first_name ?? '',
            last_name: this.userCreationService.userInfo()?.last_name ?? '',
            costCenter: demoDetailsResponse.representative_profile.cost_centre,
            jobTitle: demoDetailsResponse.representative_profile.rep_role,
            department:
              demoDetailsResponse.representative_profile.rep_department,
            orgUnitPath: demoDetailsResponse.organization_unit,
            demoName: demoDetailsResponse.demo_title,
            managerEmail:
              demoDetailsResponse.representative_profile.manager_email,
            employeeID: this.userCreationService.userInfo()?.employeeID ?? '',
          };
          return this.userCreationService.updateUserDetails(request);
        }),

        concatMap(() => {
          const request: AddUserInGroupRequest = {
            group_email: this.demoDetails()?.demo_user_group_email ?? '',
          };
          return this.userCreationService.addUserToGroup(request);
        }),
        concatMap(() => {
          const appConfig = this.reservationService.getConfig();
          return appConfig;
        }),
        catchError((error) => {
          this.errorMessage.update(
            () =>
              error?.error?.detail ||
              'Something went wrongs. Please try again.',
          );
          return of(null);
        }),
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
              err?.error?.detail || 'Something went wrong. Please try again.',
          );
          this.isLoading.update(() => false);
        },
      });
  }
  updateHomeMenuList(feature_license_app: boolean | undefined) {
    if ((feature_license_app || false) === false) {
      this.homeMenuItems = this.homeMenuItems.filter(
        (item) => item.type !== HomeItems.LICENSE_RESERVATION,
      );
    }
  }

  onItemClicked(type: HomeItems) {
    if (type === this.menuItemsEnums.FILE_A_TICKET) {
      const feedbackUrl = `${BUGANIZER_URL}&title=UserApp%20Feedback%20:%20${
        this.demoDetails()?.demo_title?.replaceAll(' ', '%20') || ''
      }&assignee=cloud-demo-operations@google.com&cc=${
        this.userDetails()?.secondary_email
      }&customFields=1232889%3A${this.demoDetails()?.demo_id || ''}&parentIssueId=${this.demoDetails()?.parent_bug_id || ''}`;
      window.open(feedbackUrl, '_blank', 'noopener noreferrer');
      return;
    }
    this.menuItemType.set(type);
    this.homeMenuItems = this.homeMenuItems.map((item) => {
      return {
        ...item,
        isSelected: item.type === type,
        redirctToReserveLicense: false,
      };
    });
  }

  onRetryCall() {
    this.errorMessage.update(() => '');
    const demoId = this.activeRoute.snapshot.queryParams['demoID'] || '';
    logInfo('homePageRetryDemoId=', this.demoId);
    if (demoId === '') {
      this.errorMessage.update(() => INVALID_DEMO_ID_MESSAGE);
      return;
    }
    this.callDemoDetailsApi(demoId);
  }

  redirectHowToLogin() {
    this.menuItemType.set(HomeItems.HOW_TO_LOGIN_IN);
    this.homeMenuItems = this.homeMenuItems.map((item) => {
      return {
        ...item,
        isSelected: item.type === HomeItems.HOW_TO_LOGIN_IN,
        redirctToReserveLicense: false,
      };
    });
  }
  redirectHowToReserveLicense() {
    this.menuItemType.set(HomeItems.HOW_TO_LOGIN_IN);
    this.homeMenuItems = this.homeMenuItems.map((item) => {
      return {
        ...item,
        isSelected: item.type === HomeItems.HOW_TO_LOGIN_IN,
        redirctToReserveLicense: true,
      };
    });
  }

  goProfileSection() {
    this.menuItemType.set(HomeItems.USER_PROFILE);
    this.homeMenuItems = this.homeMenuItems.map((item) => {
      return {
        ...item,
        isSelected: item.type === HomeItems.USER_PROFILE,
        redirctToReserveLicense: false,
      };
    });
  }

  get isRedirectToReserveLicense() {
    return this.homeMenuItems
      .filter((item) => item.type === HomeItems.HOW_TO_LOGIN_IN)
      .map((item) => item.redirctToReserveLicense)[0];
  }
}
