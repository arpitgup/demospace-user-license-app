import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { UserService } from './user.service';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

describe('UserService', () => {
  let service: UserService;
  let httpTestingController: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserService],
    });
    service = TestBed.inject(UserService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have an initial currentUser value of null', () => {
    expect(service.currentUser()).toBeNull();
  });

  describe('fetchCurrentUser', () => {
    it('should fetch the current user and update the signal on success', () => {
      const mockUser: User = {
        email: 'test@example.com',
        givenName: 'Test',
        familyName: 'User',
        fullName: 'Test User',
      };

      let actualUser: User | undefined;
      service.fetchCurrentUser().subscribe((user) => {
        actualUser = user;
      });

      const req = httpTestingController.expectOne(`${apiUrl}/api/me`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUser);

      expect(actualUser).toEqual(mockUser);
      expect(service.currentUser()).toEqual(mockUser);
    });

    it('should not update the signal on a failed request', () => {
      const errorMessage = '404 Not Found';

      service.fetchCurrentUser().subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        },
      });

      const req = httpTestingController.expectOne(`${apiUrl}/api/me`);
      req.flush(errorMessage, { status: 404, statusText: 'Not Found' });

      expect(service.currentUser()).toBeNull();
    });
  });
});
