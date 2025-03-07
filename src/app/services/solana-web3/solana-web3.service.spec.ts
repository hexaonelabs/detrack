import { TestBed } from '@angular/core/testing';

import { SolanaWeb3Service } from './solana-web3.service';

describe('SolanaWeb3Service', () => {
  let service: SolanaWeb3Service;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SolanaWeb3Service);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
