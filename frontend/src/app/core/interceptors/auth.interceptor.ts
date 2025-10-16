import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // const authService = inject(AuthService);
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
