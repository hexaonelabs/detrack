import { Inject, Injectable } from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  of,
  switchMap,
  firstValueFrom,
  tap,
  mergeMap,
  distinctUntilChanged,
  filter,
  shareReplay,
} from 'rxjs';
import { LIFIService } from '../lifi/lifi.service';
// import { StargateService } from '../stargate/stargate.service';
import {
  GroupedTokenWithBalance,
  GroupedTokenWithBalanceAndMarketData,
  TokenMarketData,
  TokenWithBalance,
} from '../../interfaces/token';
import {
  addMarketDatasFromCoingecko,
  formatDataForChart,
  isValidSvmAddress,
} from '../../app.utils';
import { CoingeckoService } from '../coingecko/coingecko.service';
import { SolanaWeb3Service } from '../solana-web3/solana-web3.service';
import { arbitrum } from 'viem/chains';
import { HyperliquidService } from '../hyperliquid/hyperliquid.service';

export interface PortfolioData {
  date: string;
  value: number;
}

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  private readonly _marketData$ = new BehaviorSubject<TokenMarketData[]>(
    [] as any
  );
  public readonly marketData$ = this._marketData$.asObservable();
  private readonly _rawTokens$: Observable<TokenWithBalance[]>;
  public readonly tokens$: Observable<
    (GroupedTokenWithBalanceAndMarketData & {
      averageCost?: number;
      totalCost?: number;
      plPercentage?: number;
      plDollars?: number;
    })[]
  >;
  public readonly balanceUSD$: Observable<number>;
  private readonly _totalBorrowsUSD$ = new BehaviorSubject<number>(0);
  public readonly totalBorrowsUSD$ = this._totalBorrowsUSD$.asObservable();
  private readonly _totalCollateralUSD$ = new BehaviorSubject<number>(0);
  public readonly totalCollateralUSD$ = this._totalCollateralUSD$.asObservable();
  private readonly _totalLiquidityDeposit$ = new BehaviorSubject<number>(0);
  public readonly totalLiquidityDeposit$ = this._totalLiquidityDeposit$.asObservable();

  constructor(
    private readonly _coinsService: CoingeckoService,
    @Inject('EVM_SERVICE') private readonly _evmService: LIFIService,
    @Inject('HYPERLIQUID_SERVICE') private readonly _hyperliquidService: HyperliquidService,
    // private readonly _cosmosService: StargateService,
    private readonly _solanaService: SolanaWeb3Service
  ) {
    this._rawTokens$ = combineLatest([
      this._evmService.tokens$,
      this._hyperliquidService.tokens$,
      // this._cosmosService.tokens$,
    ]).pipe(
      map((arrays) => arrays.flat()),
      shareReplay(1)
    );
    this.tokens$ = combineLatest([
      this._rawTokens$,
      this._marketData$.asObservable(),
      of({} as { [key: string]: { averageCost: number; totalCost: number } }), // average cost servcie
    ]).pipe(
      // group token by symbol
      map(([tokens, marketData, averageCost]) => {
        const groupedTokens = tokens.reduce((acc, asset) => {
          // check existing asset symbol
          const symbol = asset.symbol;
          const index = acc.findIndex((a) => a.symbol.toLowerCase() === symbol.toLowerCase());
          if (index !== -1) {
            acc[index]?.tokens?.push(asset);
            const isStrideLiquidToken =
              (symbol !== 'STRD' &&
                acc[index].logoURI?.includes('stride') &&
                !asset.logoURI?.includes('stride')) ||
              false;
            acc[index].logoURI = isStrideLiquidToken
              ? asset.logoURI
              : acc[index].logoURI;
            acc[index].coingeckoId =
              isStrideLiquidToken && !acc[index].coingeckoId
                ? asset.coingeckoId
                : acc[index].coingeckoId;
          } else {
            acc.push({
              name: symbol,
              symbol: symbol,
              logoURI: asset.logoURI,
              tokens: [asset],
              coingeckoId: asset.coingeckoId,
              balance: asset.balance,
              balanceUSD: asset.balanceUSD,
              priceUSD: asset.priceUSD,
            });
          }
          return acc;
        }, [] as Omit<GroupedTokenWithBalance, 'decimals'>[]);
        return {
          tokens: groupedTokens,
          marketData,
          averageCost,
        };
      }),
      switchMap(async ({ tokens, marketData, averageCost }) => {
        const formatedTokens = tokens.map((t) => {
          // formating sub token list before all
          t.tokens?.forEach((token) => {
            const tokenMarketData = marketData.find((m) =>
              t.coingeckoId
                ? m.coingeckoId === t.coingeckoId
                : m.symbol.toLowerCase() === t.symbol.toLowerCase()
            );
            const tokenPriceUSD =
              token.priceUSD === '-1'
                ? Number(tokenMarketData?.priceUSD || 0)
                : Number(token.priceUSD);
            const tokenBalance = Number(token.balance) || 0;
            if (token.priceUSD === '-1' && tokenPriceUSD) {
              token.priceUSD = tokenPriceUSD.toString();
            }
            token.balanceUSD = (tokenPriceUSD * tokenBalance).toString();
            token.logoURI = tokenMarketData?.logoURI || token.logoURI;
            token.coingeckoId = tokenMarketData?.coingeckoId || token.coingeckoId;
          });
          // add & upfdate all data of main Token
          const tokenMarketData = marketData?.find((m) =>
            t.coingeckoId
              ? m.coingeckoId === t.coingeckoId
              : m.symbol.toLowerCase() === t.symbol.toLowerCase()
          );
          const balanceUSD =
            t.tokens
              ?.reduce((acc, t) => {
                return acc + Number(t.balanceUSD);
              }, 0)
              .toString() || t.balanceUSD;
          const logoURI = tokenMarketData?.logoURI || t.logoURI;
          const balance =
            t.tokens
              ?.reduce((acc, t) => acc + Number(t.balance), 0)
              .toString() || t.balance;
          const priceUSD =
            tokenMarketData?.priceUSD || t.tokens?.[0].priceUSD || t.priceUSD;
          // const balanceUSD = String(Number(balance) * Number(priceUSD));
          const token: GroupedTokenWithBalanceAndMarketData = {
            ...tokenMarketData,
            ...t,
            balanceUSD,
            priceUSD,
            balance,
            averageCost: 0,
            totalCost: 0,
            plPercentage: 0,
            plDollars: 0,
            logoURI,
          };
          return token;
        });
        return formatedTokens;
      }),
      // calculate pnl %
      // map((tokens) => {
      //   return tokens.map((token) => {
      //     const initialInverstmentWorth =
      //       (Number(token.balanceUSD || 0)) - (token.totalCost || 0);
      //     // token.plPercentage =
      //     //   ((token.balanceUSD - initialInverstmentWorth) /
      //     //     initialInverstmentWorth) *
      //     //   100;
      //     token.plDollars = initialInverstmentWorth;
      //     return token;
      //   });
      // }),
      map((tokens) =>
        tokens.sort((a, b) => Number(b.balanceUSD) - Number(a.balanceUSD))
      ),
      tap((tokens) => {
        console.log('wallet tokens data:', tokens);
      }),
      shareReplay(1)
    );
    this.balanceUSD$ = this.tokens$.pipe(
      map((tokens) =>
        tokens
          .map(({ balanceUSD }) => Number(balanceUSD))
          .filter((balance) => balance > 0)
      ),
      map((worths) =>
        worths.reduce((acc, worth) => acc + (worth < 0 ? 0 : worth), 0)
      )
    );
  }

  async getWalletsTokens(walletsAddress: string[]) {
    const accountAddresses = new Set([...walletsAddress]);
    const evm = [...accountAddresses.values()].filter((address: string) =>
      address.startsWith('0x')
    ) as `0x${string}`[];
    const cosmos = [...accountAddresses.values()].filter((address) =>
      address.startsWith('cosmos')
    ) as `cosmos${string}`[];
    const svn = [
      // ...accountAddresses.values() // Disable SVM accounts
    ].filter((address: string) => isValidSvmAddress(address));
    await Promise.all([
      ...evm.map((address) => this._evmService.getWalletTokens(address)),
      ...evm.map((address) => this._hyperliquidService.getWalletTokens(address)),
      // ...cosmos.map((address) => this._cosmosService.getWalletTokens(address)),
      ...svn.map((address) => this._solanaService.getWalletTokens(address)),
    ]).catch((err) => err);
  }

  async getLoanPositions(walletsAddress: string[]) {
    const evm = [...walletsAddress.values()].filter((address: string) =>
      address.startsWith('0x')
    ) as `0x${string}`[];
    if (!evm.length) {
      return;
    }
    // get AAVE pool user reserve balance
    const result = await this._evmService.loadUserSummary({ account: evm[0] });
    const { totalCollateralUSD, totalBorrowsUSD, totalLiquidityUSD } = [
      ...result.values(),
    ].reduce(
      (acc, { totalCollateralUSD, totalBorrowsUSD, totalLiquidityUSD }) => {
        acc.totalCollateralUSD += Number(totalCollateralUSD);
        acc.totalBorrowsUSD += Number(totalBorrowsUSD);
        acc.totalLiquidityUSD += Number(totalLiquidityUSD);
        return acc;
      },
      { totalCollateralUSD: 0, totalBorrowsUSD: 0, totalLiquidityUSD: 0 }
    );
    this._totalBorrowsUSD$.next(totalBorrowsUSD);
    this._totalCollateralUSD$.next(totalCollateralUSD);
    this._totalLiquidityDeposit$.next(
      totalLiquidityUSD
    );
  }

  async getTokensMarketData() {
    // get all token with `totalQuantity` > 0 from `averageCost`
    const isAllTokenSymbolLoaded = await firstValueFrom(
      combineLatest([
        this._evmService.isAllTokenSymbolLoaded$,
        this._hyperliquidService.isAllTokenSymbolLoaded$,
        // this._cosmosService.isAllTokenSymbolLoaded$,
      ]).pipe(
        map((loadings) => loadings.every((loading) => loading))
      )
    );
    if (!isAllTokenSymbolLoaded) {
      console.log('waiting for all token symbol loaded');
      setTimeout(() => this.getTokensMarketData(), 1000);
      return;
    }
    const tokens = await firstValueFrom(this.tokens$);
    const tokensWithTotalQuantity = tokens
      .flatMap((token) => token.tokens || [])
      .filter((token) => Number(token.balance) > 0);
    const marketData = await addMarketDatasFromCoingecko(
      this._coinsService,
      tokensWithTotalQuantity
    );
    this._marketData$.next(marketData);
  }

  async clear() {
    this._evmService.clear();
    this._hyperliquidService.clear();
    // this._cosmosService.clear();
    this._solanaService.clear();
  }

  getPortfolioHistory$(days: number = 30) {
    return this.tokens$.pipe(
      map((tokens) => {
        const endDate = new Date();
        const startDate = new Date(
          endDate.getTime() - days * 24 * 60 * 60 * 1000
        );
        const portfolioData = tokens.map((token) => {
          const { sparkline7d } = token;
          const prices = {
            prices: formatDataForChart(sparkline7d?.price || []).map((e) => [
              e.time,
              e.value,
            ]) as [number, number][],
          };
          const result = prices.prices
            .map(([timestamp, price]: [number, number]) => {
              const date = new Date(timestamp);
              if (
                date.getTime() >= startDate.getTime() &&
                date.getTime() <= endDate.getTime()
              ) {
                const amountAtDate = Number(token.balance);
                return {
                  date: date.toISOString(),
                  value: price * amountAtDate,
                };
              }
              return null;
            })
            .filter((data) => data !== null);
          return result;
        });
        return portfolioData;
      }),
      map((coinsData) => {
        const aggregatedData: { [date: string]: number } = {};
        coinsData.forEach((coinData) => {
          coinData.forEach(({ date, value }) => {
            if (aggregatedData[date]) {
              aggregatedData[date] += value;
            } else {
              aggregatedData[date] = value;
            }
          });
        });
        return Object.entries(aggregatedData)
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((data) => data.value);
      })
    );
  }
}
