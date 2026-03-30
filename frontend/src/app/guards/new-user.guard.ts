import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { UserCreationService } from '../core/services/user-creation.service';
import { map, Observable, of } from 'rxjs';
import { UserService } from '../core/services/user.service';
import { GOOGLE_EMAIL_DOMAIN } from '../shared/constants/domain.constants';
import { logInfo } from '../../utilities/utils';
import {
  QUERY_DEMO_ID,
  SESSIONS_DEMO_ID,
} from '../shared/constants/session.constants';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class NewUserGuard implements CanActivate {
  private userCreationService = inject(UserCreationService);
  private router = inject(Router);
  private userService = inject(UserService);
  private platformId = inject(PLATFORM_ID);
  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const userEmail = this.userService.currentUser()?.email || '';
    let demoId = route.queryParamMap.get(QUERY_DEMO_ID) ?? '';
    if (isPlatformBrowser(this.platformId) && demoId === '') {
      demoId = sessionStorage.getItem(SESSIONS_DEMO_ID) ?? '';
    }
    logInfo('newUserGuardDemoId=', demoId);
    if (userEmail?.includes(GOOGLE_EMAIL_DOMAIN)) {
      if (
        this.userCreationService.userInfo() !== null &&
        userEmail === this.userCreationService.userInfo()?.primary_email &&
        this.userCreationService.userInfo()?.is_exist === false
      ) {
        return of(true);
      } else if (
        this.userCreationService.userInfo() !== null &&
        userEmail === this.userCreationService.userInfo()?.primary_email &&
        this.userCreationService.userInfo()?.is_exist === true
      ) {
        this.navigateToHome(demoId);
        return of(false);
      } else {
        return this.userCreationService.getUserDetails().pipe(
          map(() => {
            if (
              this.userCreationService.userInfo() !== null &&
              this.userCreationService.userInfo()?.is_exist === true
            ) {
              this.navigateToHome(demoId);
              return false;
            }
            return true;
          }),
        );
      }
    } else if (userEmail !== '') {
      this.router.navigateByUrl('/admin', { replaceUrl: true });
      return of(false);
    } else {
      this.router.navigateByUrl('/home', { replaceUrl: true });
      return of(false);
    }
  }
  navigateToHome(demoId: string) {
    this.router.navigateByUrl(`?demoID=${demoId}`, { replaceUrl: true });
  }
}
