import {
  ApplicationConfig,
  inject,
  PLATFORM_ID,
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

import { concatMap, of } from 'rxjs';
import { UserCreationService } from './core/services/user-creation.service';
import { UserService } from './core/services/user.service';
import { GOOGLE_EMAIL_DOMAIN } from './shared/constants/domain.constants';
import { logInfo } from '../utilities/utils';
import {
  QUERY_DEMO_ID,
  SESSIONS_DEMO_ID,
} from './shared/constants/session.constants';
import { isPlatformBrowser } from '@angular/common';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxSkeletonLoader({
      theme: {
        extendsFromRoot: true,
        height: '2rem',
      },
    }),
    UserService,
    provideAppInitializer(() => {
      const platformId = inject(PLATFORM_ID);
      if (isPlatformBrowser(platformId)) {
        const params = new URLSearchParams(window.location.search);
        const demoId = params.get(QUERY_DEMO_ID);
        if (demoId) {
          sessionStorage.setItem(SESSIONS_DEMO_ID, demoId);
        }
        logInfo('appConfigdemoID=', demoId ?? '');
        logInfo(
          'appConfigdemoID=session',
          sessionStorage.getItem(SESSIONS_DEMO_ID) ?? '',
        );
      }

      const userDetailsService = inject(UserService);
      const userCreationService = inject(UserCreationService);
      return of(null).pipe(
        concatMap(() => {
          return userDetailsService.fetchCurrentUser();
        }),

        concatMap(() => {
          if (
            userDetailsService
              .currentUser()
              ?.email.includes(GOOGLE_EMAIL_DOMAIN)
          ) {
            return userCreationService.getUserDetails();
          } else {
            return of(null);
          }
        }),
      );
    }),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(appRoutes),
    provideClientHydration(withEventReplay()),
    provideAnimations(),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, loadingInterceptor]),
    ),
  ],
};
