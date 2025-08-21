import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { loadingInterceptor } from './loading.interceptor';
import { LoaderService } from '../services/loading.service';

jest.mock('../../shared/constants/api.constants', () => ({
  EXCLUDED_URLS: ['/api/notifications', '/api/config'],
}));

describe('loadingInterceptor', () => {
  let http: HttpClient;
  let httpTestingController: HttpTestingController;
  let loaderServiceMock: LoaderService;

  beforeEach(() => {
    const loaderServiceSpy = {
      show: jest.fn(),
      hide: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
        { provide: LoaderService, useValue: loaderServiceSpy },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    loaderServiceMock = TestBed.inject(LoaderService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  describe('for standard (non-excluded) URLs', () => {
    const standardApiUrl = '/api/users';

    it('should call show() on subscription and hide() on a successful response', () => {
      http.get(standardApiUrl).subscribe();
      expect(loaderServiceMock.show).toHaveBeenCalledTimes(1);
      expect(loaderServiceMock.hide).not.toHaveBeenCalled();
      const req = httpTestingController.expectOne(standardApiUrl);
      req.flush({ success: true });
      expect(loaderServiceMock.hide).toHaveBeenCalledTimes(1);
    });

    it('should call show() on subscription and hide() on an error response', () => {
      http.get(standardApiUrl).subscribe({
        error: () => {},
      });
      expect(loaderServiceMock.show).toHaveBeenCalledTimes(1);
      expect(loaderServiceMock.hide).not.toHaveBeenCalled();
      const req = httpTestingController.expectOne(standardApiUrl);
      req.error(new ProgressEvent('error'));
      expect(loaderServiceMock.hide).toHaveBeenCalledTimes(1);
    });
  });

  describe('for excluded URLs', () => {
    const excludedApiUrl = '/api/config';

    it('should NOT call show() or hide() for an excluded URL', () => {
      http.get(excludedApiUrl).subscribe();
      const req = httpTestingController.expectOne(excludedApiUrl);
      req.flush({});
      expect(loaderServiceMock.show).not.toHaveBeenCalled();
      expect(loaderServiceMock.hide).not.toHaveBeenCalled();
    });
  });
});
