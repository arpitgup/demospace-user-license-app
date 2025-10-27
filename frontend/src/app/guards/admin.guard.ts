import { inject, Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { UserCreationService } from '../core/services/user-creation.service';
import { map, Observable, of } from 'rxjs';
import { IapService } from '../core/services/iap.service';

@Injectable({
  providedIn: 'root',
})
export class AdminGuard implements CanActivate {
  private userCreationService = inject(UserCreationService);
  private router = inject(Router);
  private iapService = inject(IapService);
  canActivate(): Observable<boolean> {
    const userEmail = this.iapService.userEmailInfo();
    if (userEmail?.includes('agentspace-demo')) {
      return this.userCreationService.getUserDetails().pipe(
        map(() => {
          if (
            this.userCreationService.userInfo() !== null &&
            this.userCreationService.userInfo()?.is_exist === true
          ) {
            this.router.navigateByUrl('', { replaceUrl: true });
          } else {
            // this.router.navigateByUrl('/welcome', { replaceUrl: true });
          }
          return false;
        })
      );
    } else {
      return of(true);
    }
  }
}
