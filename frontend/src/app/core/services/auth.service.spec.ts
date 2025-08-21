import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  describe('when userEmail exists in sessionStorage', () => {
    const mockSessionEmail = 'test-user@session.com';

    beforeEach(() => {
      jest
        .spyOn(Storage.prototype, 'getItem')
        .mockReturnValue(mockSessionEmail);

      TestBed.configureTestingModule({
        providers: [AuthService],
      });
      service = TestBed.inject(AuthService);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should return the email from sessionStorage', () => {
      expect(service.getUserEmail()).toBe(mockSessionEmail);
      expect(sessionStorage.getItem).toHaveBeenCalledWith('userEmail');
    });
  });

  describe('when userEmail does not exist in sessionStorage', () => {
    const mockEnvironmentEmail = 'fallback-user@env.com';

    beforeEach(() => {
      jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      environment.emailId = mockEnvironmentEmail;

      TestBed.configureTestingModule({
        providers: [AuthService],
      });
      service = TestBed.inject(AuthService);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should return the fallback email from the environment file', () => {
      expect(service.getUserEmail()).toBe(mockEnvironmentEmail);
      expect(sessionStorage.getItem).toHaveBeenCalledWith('userEmail');
    });
  });
});
