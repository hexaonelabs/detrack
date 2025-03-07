import { TestBed } from '@angular/core/testing';

import { LifiService } from './lifi.service';

describe('LifiService', () => {
  let service: LifiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LifiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
