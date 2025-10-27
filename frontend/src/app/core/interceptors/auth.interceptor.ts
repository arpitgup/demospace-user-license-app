import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { IapService } from '../services/iap.service';

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
    return next(req);
  }

  const clonedReq = req.clone({
    headers: req.headers
      .set('x-demo-user-email', userEmail || '')
      .set('x-user-current-time', new Date().toISOString())
      .set('x-user-token', userToken || ''),
  });
  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && req.url.includes('admin')) {
        console.error('Unauthorized request (401). Redirecting to login.');
        router.navigateByUrl('/login', { replaceUrl: true });
        return throwError(() => new Error('Unauthorized access'));
      }
      return throwError(() => error);
    })
  );
};
