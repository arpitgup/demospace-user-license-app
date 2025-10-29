import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { appRoutes } from './app.routes';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { provideNgxSkeletonLoader } from 'ngx-skeleton-loader';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { provideAnimations } from '@angular/platform-browser/animations';
import { IapService } from './core/services/iap.service';
import { concatMap, of } from 'rxjs';
import { UserCreationService } from './core/services/user-creation.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxSkeletonLoader({
      theme: {
        extendsFromRoot: true,
        height: '2rem',
      },
    }),
    IapService,
    provideAppInitializer(() => {
      const iapService = inject(IapService);
      const userService = inject(UserCreationService);
      return of(null).pipe(
        concatMap(() => {
          return iapService.getIapUserDetails();
        }),

        concatMap(() => {
          return userService.getUserDetails();
        })
      );
    }),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(appRoutes),
    provideClientHydration(withEventReplay()),
    provideAnimations(),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, loadingInterceptor])
    ),
  ],
};
