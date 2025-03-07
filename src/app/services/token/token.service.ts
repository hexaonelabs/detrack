import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  of,
  switchMap,
  firstValueFrom,
  tap,
} from 'rxjs';
import { LIFIService } from '../lifi/lifi.service';
import { StargateService } from '../stargate/stargate.service';
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

  public readonly tokens$: Observable<
    (GroupedTokenWithBalanceAndMarketData & {
      averageCost?: number;
      totalCost?: number;
      plPercentage?: number;
      plDollars?: number;
    })[]
  >;
  public readonly balanceUSD$: Observable<number>;

  constructor(
    private readonly _coinsService: CoingeckoService,
    private readonly _evmService: LIFIService,
    private readonly _cosmosService: StargateService,
    private readonly _solanaService: SolanaWeb3Service
  ) {
    const tokens$ = combineLatest([
      this._evmService.tokens$,
      this._cosmosService.tokens$,
    ]).pipe(
      map(([evmTokens, cosmosTokens]) => {
        return [...evmTokens, ...cosmosTokens];
      })
    );
    this.tokens$ = combineLatest([
      tokens$,
      this._marketData$.asObservable(),
      of({} as { [key: string]: { averageCost: number; totalCost: number } }), // average cost servcie
    ]).pipe(
      // group token by symbol
      map(([tokens, marketData, averageCost]) => {
        const groupedTokens = tokens.reduce((acc, asset) => {
          // check existing asset symbol
          const symbol =
            asset.name.toLowerCase().includes('aave') &&
            asset.name.toLowerCase() !== 'aave token' &&
            !asset.name.toLowerCase().includes('(pos)')
              ? asset.name
                  .split(' ')
                  .pop()
                  ?.replace('wst', '')
                  .replace('WETH', 'ETH')
                  .replace('WAVAX', 'AVAX')
                  .replace('USDCn', 'USDC')
                  .replace('w', '')
                  .replace('st', '')
                  .replace('s', '')
                  .replace('SAVAX', 'AVAX') ||
                asset.symbol
                  .replace('wst', '')
                  .replace('WETH', 'ETH')
                  .replace('WAVAX', 'AVAX')
                  .replace('USDCn', 'USDC')
                  .replace('w', '')
                  .replace('st', '')
                  .replace('s', '')
                  .replace('SAVAX', 'AVAX')
              : asset.symbol
                  .replace('wst', '')
                  .replace('WETH', 'ETH')
                  .replace('WAVAX', 'AVAX')
                  .replace('USDCn', 'USDC')
                  .replace('w', '')
                  .replace('st', '')
                  .replace('s', '')
                  .replace('SAVAX', 'AVAX');
          // const name =
          //   asset.name.toLowerCase().includes('aave') &&
          //   asset.name.toLowerCase() !== 'aave token'
          //     ? asset.name.split(' ').pop() || asset.name
          //     : asset.name;

          // calculate balanceUSD
          // if (Number(asset.balanceUSD) <= 0) {
          //   const totalUsd = Number(asset.priceUSD) * Number(asset.balance);
          //   asset.balanceUSD = `${totalUsd || 0}`;
          // }
          const index = acc.findIndex((a) => a.symbol === symbol);
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
            });
          }
          return acc;
        }, [] as Omit<GroupedTokenWithBalance, 'balanceUSD' | 'priceUSD' | 'balance' | 'decimals'>[]);
        return {
          tokens: groupedTokens,
          marketData,
          averageCost,
        };
      }),
      switchMap(async ({ tokens, marketData, averageCost }) => {
        const formatedTokens = tokens.map((t) => {
          // formating sub token list before all
          t.tokens.forEach((token) => {
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
          });
          // add & upfdate all data of main Token
          const tokenMarketData = marketData?.find((m) =>
            t.coingeckoId
              ? m.coingeckoId === t.coingeckoId
              : m.symbol.toLowerCase() === t.symbol.toLowerCase()
          );
          const balance = t.tokens
            .reduce((acc, t) => acc + Number(t.balance), 0)
            .toString();
          const balanceUSD = t.tokens
            .reduce((acc, t) => acc + Number(t.balanceUSD), 0)
            .toString();
          const priceUSD = tokenMarketData?.priceUSD || '0';
          const logoURI = tokenMarketData?.logoURI || t.logoURI;
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
      )
      // tap((tokens) => {
      //   console.log('wallet tokens data:', tokens);
      // })
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
    const evm = [
      ...accountAddresses.values()
    ].filter((address: string) => address.startsWith('0x')) as `0x${string}`[];
    const cosmos = [...accountAddresses.values()].filter((address) =>
      address.startsWith('cosmos')
    ) as `cosmos${string}`[];
    const svn = [
      // ...accountAddresses.values() // Disable SVM accounts
    ].filter((address: string) => isValidSvmAddress(address));
    await Promise.all([
      ...evm.map((address) => this._evmService.getWalletTokens(address)),
      ...cosmos.map((address) => this._cosmosService.getWalletTokens(address)),
      ...svn.map((address) => this._solanaService.getWalletTokens(address)),
    ]).catch(err => err);
    // const tokens = await firstValueFrom(this.tokens$);
    // console.log(`[INFO] Wallets tokens loaded:`, tokens);
  }

  async getTokensMarketData() {
    // get all token with `totalQuantity` > 0 from `averageCost`
    const isAllTokenSymbolLoaded = await firstValueFrom(combineLatest([
      this._evmService.isAllTokenSymbolLoaded$,
      this._cosmosService.isAllTokenSymbolLoaded$,
    ]).pipe(
      map((loadings) => loadings.every((loading) => loading))
    ));
    if (!isAllTokenSymbolLoaded) {
      console.log('waiting for all token symbol loaded');
      setTimeout(() => this.getTokensMarketData(), 1000);
      return;
    }
    const tokens = await firstValueFrom(this.tokens$);
    const tokensWithTotalQuantity = tokens
      .flatMap((token) => token.tokens)
      .filter((token) => Number(token.balance) > 0);
    const marketData = await addMarketDatasFromCoingecko(
      this._coinsService,
      tokensWithTotalQuantity
    );
    console.log('marketData loaded', marketData);
    this._marketData$.next(marketData);
  }

  async clear() {
    this._evmService.clear();
    this._cosmosService.clear();
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
        console.log('coinsData', coinsData);
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
