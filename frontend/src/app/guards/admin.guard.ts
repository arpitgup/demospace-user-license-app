import { inject, Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { UserCreationService } from '../core/services/user-creation.service';
import { map, Observable, of } from 'rxjs';
import { UserService } from '../core/services/user.service';
import { GOOGLE_EMAIL_DOMAIN } from '../shared/constants/domain.constants';

@Injectable({
  providedIn: 'root',
})
export class AdminGuard implements CanActivate {
  private userCreationService = inject(UserCreationService);
  private router = inject(Router);
  private userService = inject(UserService);
  canActivate(): Observable<boolean> {
    const userEmail = this.userService.currentUser()?.email || '';
    if (userEmail?.includes(GOOGLE_EMAIL_DOMAIN)) {
      return this.userCreationService.getUserDetails().pipe(
        map(() => {
          if (
            this.userCreationService.userInfo() !== null &&
            this.userCreationService.userInfo()?.is_exist === true
          ) {
            this.router.navigateByUrl('', { replaceUrl: true });
          } else {
            this.router.navigateByUrl('/welcome', { replaceUrl: true });
          }
          return false;
        }),
      );
    } else {
      return of(true);
    }
  }
}
