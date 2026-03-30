import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  UrlTree,
} from '@angular/router';
import { UserCreationService } from '../core/services/user-creation.service';
import { Observable, of, tap } from 'rxjs';
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
export class EmailGuard implements CanActivate {
  private userCreationService = inject(UserCreationService);
  private router = inject(Router);
  private userService = inject(UserService);
  private platformId = inject(PLATFORM_ID);
  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    const userEmail = this.userService.currentUser()?.email || '';
    let demoId = route.queryParamMap.get(QUERY_DEMO_ID) ?? '';
    if (isPlatformBrowser(this.platformId) && demoId === '') {
      demoId = sessionStorage.getItem(SESSIONS_DEMO_ID) ?? '';
    }
    logInfo('emailGuardDemoId=', demoId);
    if (userEmail?.includes(GOOGLE_EMAIL_DOMAIN)) {
      if (
        this.userCreationService.userInfo() !== null &&
        this.userCreationService.userInfo()?.is_exist === true
      ) {
        return of(true);
      } else if (
        this.userCreationService.userInfo() !== null &&
        this.userCreationService.userInfo()?.is_exist === false
      ) {
        this.redirectToWelcome(demoId);
        return of(false);
      } else {
        return this.userCreationService.getUserDetails().pipe(
          tap((data) => {
            if (data === false) {
              this.redirectToWelcome(demoId);
            }
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
  redirectToWelcome(demoId: string) {
    this.router.navigateByUrl(`/welcome?demoID=${demoId}`, {
      replaceUrl: true,
    });
  }
}
