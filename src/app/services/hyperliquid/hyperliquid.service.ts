import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, map } from 'rxjs';
import { Token, TokenWithBalance } from '../../interfaces/token';
import { createPublicClient, http, parseAbi, zeroAddress } from 'viem';

@Injectable()
export class HyperliquidService {
  private readonly _chain = {
    id: 999,
    name: 'Hyperliquid',
    rpcUrls: {
      default: {
        http: ['https://rpc.hyperliquid.xyz/evm'],
      },
    },
    nativeCurrency: {
      name: 'Hyperliquid',
      symbol: 'HYPER',
      decimals: 18,
    },
  };
  private readonly _tokens$: BehaviorSubject<TokenWithBalance[]> =
    new BehaviorSubject([] as TokenWithBalance[]);
  public readonly tokens$ = this._tokens$.asObservable().pipe(
    // remove tokens with balance <= 0
    map((tokens) => tokens.filter((t) => Number(t.balance) > 0))
  );
  private readonly _totalTokenToCheck$ = new BehaviorSubject(0);
  public readonly isAllTokenSymbolLoaded$ = this._totalTokenToCheck$
    .asObservable()
    .pipe(map((total) => total <= 0));

  constructor(private readonly http: HttpClient) {}

  async clear() {
    this._tokens$.next([]);
    this._totalTokenToCheck$.next(0);
  }

  async getWalletTokens(walletAddress: `0x${string}`): Promise<void> {
    // check in storage for tokens stored 15 minutes ago
    const storedTokens = localStorage.getItem(
      `tokens-${walletAddress}-${this._chain.id}`
    );

    if (storedTokens) {
      const parsedStoredTokens = JSON.parse(storedTokens);
      const storedDate = new Date(parsedStoredTokens.date);
      const currentDate = new Date();
      const diff = Math.abs(currentDate.getTime() - storedDate.getTime());
      const diffMinutes = Math.floor(diff / (1000 * 60));
      if (diffMinutes < 15) {
        console.log(
          `Tokens for chainId ${this._chain.id} loaded from local storage.`
        );
        const tokens = parsedStoredTokens.tokens;
        this._tokens$.next([...this._tokens$.value, ...tokens]);
      } else {
        // remove expired tokens from local storage
        localStorage.removeItem(`tokens-${walletAddress}-${this._chain.id}`);
        console.log(
          `Tokens for chainId ${this._chain.id} loaded from local storage but expired.`
        );
      }
    } else {
      // get CORE balance
      const coreTokens = await this._getCOREBalance(walletAddress);
      // get EVM balance
      const tokens = await this._getEVMTokens();
      this._totalTokenToCheck$.next(tokens.length);
      const tokensWithBalance = await this._getAccountTokensBalance(
        tokens,
        walletAddress
      );
      const allTokens = [...tokensWithBalance, ...coreTokens];
      // store tokens in local storage
      localStorage.setItem(
        `tokens-${walletAddress}-${this._chain.id}`,
        JSON.stringify({
          date: new Date(),
          tokens: allTokens,
        })
      );
      // update state
      this._tokens$.next(allTokens);
      this._totalTokenToCheck$.next(0);
    }
  }

  private async _getEVMTokens() {
    const response = await firstValueFrom(
      this.http.get<{
        tokens: {
          name: string;
          decimals: number;
          symbol: string;
          address: string;
          chainId: number;
          logoURI: string;
        }[];
      }>(
        'https://raw.githubusercontent.com/HyperSwapX/hyperswap-token-list/refs/heads/main/tokens.json'
      )
    );
    const formatedTokens: Token[] = response.tokens.map((token) => {
      return {
        name: token.name,
        decimals: token.decimals,
        symbol: token.symbol,
        address: token.address,
        chainId: token.chainId.toString(),
        logoURI: token.logoURI,
        priceUSD: '0',
      };
    });
    return [
      ...formatedTokens,
      {
        name: 'Hype',
        decimals: 18,
        symbol: 'HYPE',
        address: zeroAddress,
        chainId: this._chain.id.toString(),
        priceUSD: '-1',
      }
    ];
  }

  private async _getCOREBalance(walletAddress: `0x${string}`): Promise<TokenWithBalance[]> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    })
    const response = await firstValueFrom(
      this.http.post<{
        tokens?: {
          name: string;
          szDecimals: number;
          weiDecimals: number;
          tokenId: string;
          isCanonical: boolean;
          evmContract: any;
          fullName?: string;
        }[];
        balances: [
          {
              coin: string;
              token: number;
              hold: string;
              total: string;
              entryNtl: string;
          },
      ]
      }>('https://api.hyperliquid.xyz/info', {
        type: 'spotClearinghouseState',
        user: walletAddress,
      }, { headers})
    );
    const preFormatedTokens = response.balances.map((token) => {
      return {
        name: token.coin,
        symbol: token.coin,
        chainId: 'HyperCore',
        address: 'token.token',
        decimals:  18 ,
        priceUSD: '-1',
        balance: token.total,
        balanceUSD: '-1',
      };
    });
    return preFormatedTokens;
  }

  private async _getAccountTokensBalance(
    tokens: Token[],
    walletAddress: `0x${string}`
  ): Promise<TokenWithBalance[]> {
    const client = createPublicClient({
      chain: this._chain,
      transport: http(),
    });
    const abi = parseAbi([
      'function balanceOf(address account) public view returns (uint256)',
    ]);
    const erc20Tokens = tokens.filter(
      (t) => t.address.toLowerCase() !== zeroAddress.toLowerCase()
    );

    const updatedTokens: (TokenWithBalance | null)[] = [];
    for (const token of erc20Tokens) {
      try {
        const balance = await client.readContract({
          address: token.address as `0x${string}`,
          abi,
          functionName: 'balanceOf',
          args: [walletAddress],
        });
        const formattedBalance = (
          Number(balance) /
          10 ** token.decimals
        ).toString();
        // console.log(
        //   `Balance of ${token.symbol}: ${balance} (${formattedBalance}) (${token.address})`
        // );
        const tokenBalance = {
          ...token,
          chainId: String(token.chainId),
          balance: formattedBalance,
          balanceUSD: (
            Number(formattedBalance) * Number(token.priceUSD || 0)
          ).toString(),
        };
        if (Number(tokenBalance.balance) > 0) {
          updatedTokens.push(tokenBalance);
        }
      } catch (error) {
        console.error(`Error getting balance for ${token.symbol}:`, error);
        updatedTokens.push(null);
      }
    }

    const zeroToken = tokens.find(
      (t) => t.address.toLowerCase() === zeroAddress.toLowerCase()
    );
    if (zeroToken) {
      try {
        const balance = await client
          .getBalance({ address: walletAddress })
          .then((b) => (Number(b) / 10 ** zeroToken.decimals).toString());
        const zeroTokenBalance = {
          ...zeroToken,
          chainId: String(zeroToken.chainId),
          balance,
          balanceUSD: (Number(balance) * Number(zeroToken.priceUSD)).toString(),
        };
        updatedTokens.push(zeroTokenBalance);
      } catch (error) {
        console.error('Error getting balance for native token:', error);
      }
    }

    const validTokens = updatedTokens
      .filter((token) => token !== null)
      .filter((t) => !t!.symbol.startsWith('a')) as TokenWithBalance[];
    console.log('Valid tokens:', validTokens);
    this._tokens$.next([...this._tokens$.value, ...validTokens]);
    return validTokens;
  }
}
