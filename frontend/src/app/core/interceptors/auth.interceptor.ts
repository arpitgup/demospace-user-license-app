import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const userEmail = authService.getUserEmail();

  if (!userEmail) {
    return next(req);
  }

  const clonedReq = req.clone({
    headers: req.headers.set('x-demo-user-email', userEmail),
  });

  return next(clonedReq);
};
