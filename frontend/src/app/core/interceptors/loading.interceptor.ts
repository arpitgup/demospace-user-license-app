// src/app/core/interceptors/loading.interceptor.ts

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { EXCLUDED_URLS } from '../../shared/constants/api.constants';
import { LoaderService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoaderService);
  const isExcluded = EXCLUDED_URLS.some((url) => req.url.includes(url));

  if (!isExcluded) {
    loadingService.show();
  }

  return next(req);
};
