import { TestBed } from '@angular/core/testing';
import { LoaderService } from './loading.service';

describe('LoaderService', () => {
  let service: LoaderService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoaderService],
    });
    service = TestBed.inject(LoaderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial state of loading as false and activeRequests as 0', () => {
    expect(service.loading()).toBe(false);
    expect(service['activeRequests']()).toBe(0);
  });

  it('should set loading to true and increment activeRequests when show() is called', () => {
    service.show();
    expect(service.loading()).toBe(true);
    expect(service['activeRequests']()).toBe(1);
  });

  it('should keep loading as true when hide() is called but activeRequests is still greater than 0', () => {
    service.show();
    service.show();
    service.hide();
    expect(service.loading()).toBe(true);
    expect(service['activeRequests']()).toBe(1);
  });

  it('should set loading to false when hide() is called and activeRequests becomes 0', () => {
    service.show();
    service.hide();
    expect(service.loading()).toBe(false);
    expect(service['activeRequests']()).toBe(0);
  });

  it('should handle multiple show and hide calls correctly', () => {
    service.show();
    service.show();
    service.show();
    expect(service.loading()).toBe(true);
    expect(service['activeRequests']()).toBe(3);

    service.hide();
    expect(service.loading()).toBe(true);
    expect(service['activeRequests']()).toBe(2);

    service.hide();
    expect(service.loading()).toBe(true);
    expect(service['activeRequests']()).toBe(1);

    service.hide();
    expect(service.loading()).toBe(false);
    expect(service['activeRequests']()).toBe(0);
  });

  it('should not allow activeRequests to go below 0', () => {
    service.hide();
    service.hide();
    expect(service.loading()).toBe(false);
    expect(service['activeRequests']()).toBe(0);
  });
});
