import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  finalize,
  retry,
  tap,
  throwError,
  timeout,
  TimeoutError,
  timer,
} from 'rxjs';
import { IapService } from '../services/iap.service';
import { BUGANIZER_URL } from '../../shared/constants/links.contants';
import { LoaderService } from '../services/loading.service';
import { EXCLUDED_URLS } from '../../shared/constants/api.constants';

const DEFAULT_TIMEOUT = 30000;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoaderService);
  const isExcluded = EXCLUDED_URLS.some((url) => req.url.includes(url));

  const iapService = inject(IapService);
  if (req.url.includes('_gcp_iap/identity')) {
    return next(req).pipe(
      finalize(() => {
        if (!isExcluded) {
          loadingService.hide();
        }
      })
    );
  } else if (req.url.includes('user-management/user-details')) {
    const clonedReq = req.clone({
      headers: req.headers
        .set('x-demo-user-email', iapService.userEmailInfo())
        .set('x-user-current-time', new Date().toISOString()),
    });
    return next(clonedReq).pipe(
      finalize(() => {
        if (!isExcluded) {
          loadingService.hide();
        }
      })
    );
  }
  const userEmail = sessionStorage?.getItem('userEmail');
  const userToken = sessionStorage.getItem('userToken');
  const router = inject(Router);
  if (!userToken && req.url.includes('admin')) {
    router.navigateByUrl('/login', { replaceUrl: true });
    return throwError(() => new Error('Invalid request'));
  }

  if (!userEmail && !req.url.includes('login')) {
    return callApi(req, next, false, isExcluded, loadingService);
  }

  const clonedReq = req.clone({
    headers: req.headers
      .set('x-demo-user-email', userEmail || '')
      .set('x-user-current-time', new Date().toISOString())
      .set('x-user-token', userToken || ''),
  });
  return callApi(clonedReq, next, true, isExcluded, loadingService);
};
function callApi(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  isLoginRedirect: boolean,
  isExcluded: boolean,
  loadingService: LoaderService
): import('rxjs').Observable<
  import('@angular/common/http').HttpEvent<unknown>
> {
  const router = inject(Router);
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        if (!isExcluded) {
          loadingService.hide();
        }
      }
    }),
    timeout(DEFAULT_TIMEOUT),
    retry({
      count: 5,
      delay: (error) => {
        if (error.status === 503 || error.status === 500) {
          return timer(1000);
        } else {
          return throwError(() => error);
        }
      },
    }),
    catchError((error: HttpErrorResponse) => {
      if (!isExcluded) {
        loadingService.hide();
      }
      if (error instanceof TimeoutError) {
        const customError = {
          error: {
            detail: `Seems like we are experiencing an issue. Please try again later. If the issue persists, file a feedback ticket <a href="${BUGANIZER_URL}"
          target="_blank"
          rel="noopener noreferrer"> HERE.</a>`,
          },
        };
        return throwError(() => customError);
      } else if (
        error.status === 401 &&
        req.url.includes('admin') &&
        isLoginRedirect
      ) {
        console.error('Unauthorized request (401). Redirecting to login.');
        router.navigateByUrl('/login', { replaceUrl: true });
        return throwError(() => new Error('Unauthorized access'));
      }
      return throwError(() => error);
    })
  );
}
