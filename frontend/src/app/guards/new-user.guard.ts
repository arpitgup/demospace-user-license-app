import { inject, Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
} from '@angular/router';
import { UserCreationService } from '../core/services/user-creation.service';
import { map, Observable, of } from 'rxjs';
import { UserService } from '../core/services/user.service';

@Injectable({
  providedIn: 'root',
})
export class NewUserGuard implements CanActivate {
  private userCreationService = inject(UserCreationService);
  private router = inject(Router);
  private userService = inject(UserService);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const userEmail = this.userService.userEmailInfo();
    const demoId = route.queryParamMap.get('demoID') || '';
    if (userEmail?.includes('agentspace-demo') || userEmail?.includes('godemos')) {
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
  navigateToHome(demoId: string) {
    this.router.navigateByUrl(`?demoID=${demoId}`, { replaceUrl: true });
  }
}
