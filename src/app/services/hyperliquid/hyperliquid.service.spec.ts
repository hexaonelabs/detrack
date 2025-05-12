import { TestBed } from '@angular/core/testing';

import { HyperliquidService } from './hyperliquid.service';

describe('HyperliquidService', () => {
  let service: HyperliquidService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HyperliquidService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
