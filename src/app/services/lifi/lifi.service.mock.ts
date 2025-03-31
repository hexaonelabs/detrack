import { Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { TokenWithBalance } from '../../interfaces/token';
import { Token, TokensResponse } from '@lifi/sdk';

@Injectable({
  providedIn: 'root',
})
export class MockLIFIService {
  private readonly _tokens$: BehaviorSubject<TokenWithBalance[]> =
    new BehaviorSubject([] as TokenWithBalance[]);
  public readonly tokens$ = this._tokens$.asObservable();
  private readonly _totalTokenToCheck$ = new BehaviorSubject(0);
  public readonly isAllTokenSymbolLoaded$ = this._totalTokenToCheck$.asObservable().pipe(
    map((total) => total <= 0)
  );

  async clear() {
    this._tokens$.next([]);
    this._totalTokenToCheck$.next(0);
  }

  async getWalletTokens(walletAddress: `0x${string}`): Promise<void> {
    const mockTokensResponse: TokensResponse = {
      tokens: {
        1: [
          { address: '0xToken1', chainId: 1, decimals: 18, priceUSD: '1.0', symbol: 'TKN1', name: 'Token 1' },
          { address: '0xToken2', chainId: 1, decimals: 18, priceUSD: '2.0', symbol: 'TKN2', name: 'Token 2' },
        ],
        56: [
          { address: '0xToken3', chainId: 56, decimals: 18, priceUSD: '3.0', symbol: 'TKN3', name: 'Token 3' },
          { address: '0xToken4', chainId: 56, decimals: 18, priceUSD: '4.0', symbol: 'TKN4', name: 'Token 4' },
        ],
      },
    };

    const chainTokens = mockTokensResponse.tokens;
    const totalTokenToCheck = Object.values(chainTokens).reduce(
      (acc, tokens) => acc + tokens.length,
      0
    );
    this._totalTokenToCheck$.next(totalTokenToCheck);

    for (const chainId in chainTokens) {
      const tokens = (chainTokens as any)[Number(chainId)];
      this._getAccountTokensBalance(tokens, walletAddress);
    }
  }

  private async _getAccountTokensBalance(
    chainTokens: Token[],
    accountAddress: `0x${string}`
  ): Promise<void> {
    for (const token of chainTokens) {
      const tokenBalance = {
        ...token,
        chainId: String(token.chainId),
        balance: '100.0',
        balanceUSD: (100.0 * Number(token.priceUSD)).toString(),
      };
      this._tokens$.next([...this._tokens$.value, tokenBalance]);
      this._totalTokenToCheck$.next(this._totalTokenToCheck$.value - 1);
    }
  }

  private async _getAAVEPoolUserReserveBalance(
    accountAddress: `0x${string}`
  ): Promise<void> {}
}