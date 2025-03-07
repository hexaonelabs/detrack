import { TestBed } from '@angular/core/testing';

import { StargateService } from './stargate.service';

describe('StargateService', () => {
  let service: StargateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StargateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
