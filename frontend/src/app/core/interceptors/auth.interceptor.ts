import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  retry,
  throwError,
  timeout,
  TimeoutError,
  timer,
} from 'rxjs';
import { IapService } from '../services/iap.service';
import { BUGANIZER_URL } from '../../shared/constants/links.contants';

const DEFAULT_TIMEOUT = 30000;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const iapService = inject(IapService);
  if (req.url.includes('_gcp_iap/identity')) {
    return next(req);
  } else if (req.url.includes('user-management/user-details')) {
    const clonedReq = req.clone({
      headers: req.headers
        .set('x-demo-user-email', iapService.userEmailInfo())
        .set('x-user-current-time', new Date().toISOString()),
    });
    return next(clonedReq);
  }
  const userEmail = sessionStorage?.getItem('userEmail');
  const userToken = sessionStorage.getItem('userToken');
  const router = inject(Router);
  if (!userToken && req.url.includes('admin')) {
    router.navigateByUrl('/login', { replaceUrl: true });
    return throwError(() => new Error('Invalid request'));
  }

  if (!userEmail && !req.url.includes('login')) {
    return callApi(req, next, false);
  }

  const clonedReq = req.clone({
    headers: req.headers
      .set('x-demo-user-email', userEmail || '')
      .set('x-user-current-time', new Date().toISOString())
      .set('x-user-token', userToken || ''),
  });
  return callApi(clonedReq, next, true);
};
function callApi(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  isLoginRedirect: boolean
): import('rxjs').Observable<
  import('@angular/common/http').HttpEvent<unknown>
> {
  const router = inject(Router);
  return next(req).pipe(
    timeout(DEFAULT_TIMEOUT),
    retry({
      count: 5,
      delay: (error) => {
        if (error.status === 503) {
          return timer(1000);
        }

        return timer(500);
      },
    }),
    catchError((error: HttpErrorResponse) => {
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
