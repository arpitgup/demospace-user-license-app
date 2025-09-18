import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // const authService = inject(AuthService);
  const userEmail = localStorage?.getItem('userEmail');
  // const userToken = authService.getToken();
  const router = inject(Router);

  if (!localStorage?.getItem('googleIdToken') && req.url.includes('admin')) {
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
  return next(clonedReq);
};
