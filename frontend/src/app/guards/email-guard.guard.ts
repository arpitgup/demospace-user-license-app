import { inject, Injectable } from '@angular/core';
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

@Injectable({
  providedIn: 'root',
})
export class EmailGuard implements CanActivate {
  private userCreationService = inject(UserCreationService);
  private router = inject(Router);
  private userService = inject(UserService);
  private activeRoute = inject(ActivatedRoute);
  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    const userEmail = this.userService.userEmailInfo();
    const demoId = route.queryParamMap.get('demoID') || '';
    if (userEmail?.includes('agentspace-demo')) {
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
          })
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
