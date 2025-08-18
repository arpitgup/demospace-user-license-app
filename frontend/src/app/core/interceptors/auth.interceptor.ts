import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // const authService = inject(AuthService);
  // const userEmail = authService.getUserEmail();
  let userEmail;
  if (typeof window !== 'undefined') {
    userEmail = sessionStorage.getItem('userEmail');
  }

  if (!userEmail) {
    return next(req);
  }

  const clonedReq = req.clone({
    headers: req.headers.set('x-demo-user-email', userEmail),
  });

  return next(clonedReq);
};
