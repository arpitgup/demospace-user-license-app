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
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTestingController: HttpTestingController;
  let authServiceMock: Partial<AuthService>;

  const testUrl = '/api/data';
  const testEmail = 'test@example.com';

  const setupTestBed = (userEmail: string | null) => {
    authServiceMock = {
      getUserEmail: jest.fn().mockReturnValue(userEmail),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  };

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should add "x-demo-user-email" header when user email exists', () => {
    setupTestBed(testEmail);
    http.get(testUrl).subscribe();
    const req = httpTestingController.expectOne(testUrl);
    expect(req.request.headers.has('x-demo-user-email')).toBe(true);
    expect(req.request.headers.get('x-demo-user-email')).toBe(testEmail);
    req.flush({});
  });

  it('should not add "x-demo-user-email" header when user email does not exist', () => {
    setupTestBed(null);
    http.get(testUrl).subscribe();
    const req = httpTestingController.expectOne(testUrl);
    expect(req.request.headers.has('x-demo-user-email')).toBe(false);
    req.flush({});
  });

  it('should not modify original headers when adding the new header', () => {
    setupTestBed(testEmail);
    const originalHeaders = { Authorization: 'Bearer token123' };
    http.get(testUrl, { headers: originalHeaders }).subscribe();
    const req = httpTestingController.expectOne(testUrl);
    expect(req.request.headers.has('Authorization')).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token123');
    expect(req.request.headers.get('x-demo-user-email')).toBe(testEmail);
    req.flush({});
  });
});
