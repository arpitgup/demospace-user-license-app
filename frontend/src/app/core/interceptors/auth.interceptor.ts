import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // const authService = inject(AuthService);
  const userEmail = sessionStorage?.getItem('userEmail');
  // const userToken = authService.getToken();
  const router = inject(Router);

  if (!sessionStorage?.getItem('googleIdToken') && req.url.includes('admin')) {
    router.navigate(['/login']);

    return throwError(() => new Error('Invalid request'));
  }

  if (!userEmail && !req.url.includes('login')) {
    return next(req);
  }

  const clonedReq = req.clone({
    headers: req.headers
      .set('x-demo-user-email', userEmail || '')
      .set('x-user-current-time', new Date().toISOString()),
  });
  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && req.url.includes('admin')) {
        console.error('Unauthorized request (401). Redirecting to login.');
        router.navigate(['/login']);
        return throwError(() => new Error('Unauthorized access'));
      }
      return throwError(() => error);
    })
  );
};
