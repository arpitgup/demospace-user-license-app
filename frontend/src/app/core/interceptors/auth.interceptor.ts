import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const userEmail = authService.getUserEmail();

  if (!userEmail) {
    return next(req);
  }

  const clonedReq = req.clone({
    headers: req.headers.set('x-goog-authenticated-user-email', userEmail)
  });

  return next(clonedReq);
};