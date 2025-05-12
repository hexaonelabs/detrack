import { Injectable } from '@angular/core';
import { getTokens, Token } from '@lifi/sdk';
import { BehaviorSubject, map, tap } from 'rxjs';
import {
  createPublicClient,
  formatEther,
  getAddress,
  getContract,
  http,
  parseAbi,
  zeroAddress,
} from 'viem';
import * as CHAINS from 'viem/chains';
import { TokenWithBalance } from '../../interfaces/token';
import { TxDetail } from '../../interfaces/tx';
import { environment } from '../../../environments/environment';
import {
  UiPoolDataProvider,
  UiIncentiveDataProvider,
  ChainId,
  ReserveDataHumanized,
} from '@aave/contract-helpers';
import * as markets from '@bgd-labs/aave-address-book';
import dayjs from 'dayjs';
import {
  formatReserves,
  FormatReserveUSDResponse,
  formatUserSummary,
  FormatUserSummaryResponse,
} from '@aave/math-utils';
import { providers } from 'ethers';

export interface TokenState {
  totalQuantity: number;
  totalCost: number;
  averageCost: number;
  txs: any[];
}

export const AVAILABLE_CHAINS = [
  {
    ...CHAINS.mainnet,
    chainKey: 'ethereum',
  },
  {
    ...CHAINS.optimism,
    chainKey: 'optimism',
  },
  {
    ...CHAINS.arbitrum,
    chainKey: 'arbitrum',
  },
  // {
  //   ...CHAINS.polygon,
  //   chainKey: 'polygon',
  // },
  // CHAINS.bsc,
  // CHAINS.avalanche,
  // CHAINS.base,
  // CHAINS.zksync,
  // CHAINS.scroll,
  // CHAINS.gnosis,
  // CHAINS.polygonZkEvm,
  // CHAINS.sei,
  // CHAINS.abstract,
  // CHAINS.metis,
  // CHAINS.blast,
  // CHAINS.linea,
  // CHAINS.fantom,
  // CHAINS.sonic,
  // CHAINS.mode,
  // CHAINS.unichain,
  // CHAINS.celo,
  // CHAINS.mantle,
  // CHAINS.berachain,
];

@Injectable()
export class LIFIService {
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

  async clear() {
    this._tokens$.next([]);
    this._totalTokenToCheck$.next(0);
  }

  async getWalletTokens(walletAddress: `0x${string}`): Promise<void> {
    const tokensResponse = await getTokens({
      minPriceUSD: 0.25,
    });
    // filter tokensResponse.tokens with AVAILABLE_CHAINS
    const chainIds = Object.keys(tokensResponse.tokens).filter((chainId) =>
      AVAILABLE_CHAINS.some((chain) => chain.id === Number(chainId))
    );
    const chainTokens = chainIds.reduce((acc, chainId) => {
      acc[String(chainId)] = tokensResponse.tokens[Number(chainId)];
      return acc;
    }, {} as { [chainId: string]: Token[] });
    const totalTokenToCheck = Object.values(chainTokens).reduce(
      (acc, tokens) => acc + tokens.length,
      0
    );
    this._totalTokenToCheck$.next(totalTokenToCheck);
    for (const chainId in chainTokens) {
      // check in storage for tokens stored 15 minutes ago
      const storedTokens = localStorage.getItem(
        `tokens-${walletAddress}-${chainId}`
      );
      if (storedTokens) {
        const parsedStoredTokens = JSON.parse(storedTokens);
        const storedDate = new Date(parsedStoredTokens.date);
        const currentDate = new Date();
        const diff = Math.abs(currentDate.getTime() - storedDate.getTime());
        const diffMinutes = Math.floor(diff / (1000 * 60));
        if (diffMinutes < 15) {
          console.log(
            `Tokens for chainId ${chainId} loaded from local storage.`
          );
          const tokens = parsedStoredTokens.tokens;
          this._tokens$.next([...this._tokens$.value, ...tokens]);
        } else {
          // remove expired tokens from local storage
          localStorage.removeItem(`tokens-${walletAddress}-${chainId}`);
          console.log(
            `Tokens for chainId ${chainId} loaded from local storage but expired.`
          );
        }
      } else {
        console.log(`Loading tokens for chainId: ${chainId}...`);
        const tokens = tokensResponse.tokens[Number(chainId)];
        const accountTokensWithBalance = await this._getAccountTokensBalance(
          tokens,
          walletAddress
        );
        // save tokens into local storage
        try {
          localStorage.setItem(
            `tokens-${walletAddress}-${chainId}`,
            JSON.stringify({
              date: new Date(),
              tokens: accountTokensWithBalance,
            })
          );
        } catch (error) {
          console.error(error);
        }
      }
      // decrease totalTokenToCheck
      this._totalTokenToCheck$.next(
        this._totalTokenToCheck$.value - chainTokens[chainId].length
      );
      console.log(
        `✅ Tokens loaded for chainId: ${chainId}. Rest : ${this._totalTokenToCheck$.value} tokens to check`
      );
    }
  }

  async getTxsFromEtherscan(walletAddress: `0x${string}`): Promise<TxDetail[]> {
    const formatTx = async (tx: any) => {
      // Extraire le nom de la fonction et les paramètres
      const result = await fetch(
        'https://li.quest/v1/calldata/parse?chainId=10&callData=' + tx.input,
        options
      ).then((res) => res.json());

      const formattedTx = {
        hash: tx.hash,
        from: getAddress(tx.from),
        to: tx.to ? getAddress(tx.to) : 'Contract Creation',
        value: formatEther(tx.value),
        gasPrice: formatEther(tx.gasPrice),
        gasUsed: tx.gas.toString(),
        timestamp: new Date(Number(tx.blockTimestamp) * 1000).toLocaleString(),
        status: tx.blockNumber ? 'Confirmed' : 'Pending',
        ...result,
      };
      console.log('formattedTx', formattedTx);
      return formattedTx;
    };
    // check into localstorage
    const txs = localStorage.getItem(`txs-${walletAddress}`);
    if (txs) {
      return JSON.parse(txs);
    }
    // fetch txs from etherscan
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    };
    const result = [];
    const API_KEY = environment.etherscan_apikey;
    const { result: data } = await fetch(
      `https://api.etherscan.io/v2/api?chainid=${10}&module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${API_KEY}`,
      options
    )
      .then((res) => res.json())
      .then((res) => res);
    const parsed = await Promise.all(data.map(formatTx));
    result.push(...parsed);
    // save into localstorage
    try {
      localStorage.setItem(`txs-${walletAddress}`, JSON.stringify(result));
    } catch (error) {
      console.error(error);
    }
    // return value
    return result;
  }

  private async _getAccountTokensBalance(
    tokens: Token[],
    walletAddress: `0x${string}`
  ): Promise<TokenWithBalance[]> {
    const chain = Object.values(CHAINS).find(
      (c) => c.id === Number(tokens[0].chainId)
    )!;
    const client = createPublicClient({
      chain,
      transport: http(),
    });
    const abi = parseAbi([
      'function name() public view returns (string memory)',
      'function symbol() view returns (string memory)',
      'function decimals() view returns (uint8)',
      'function balanceOf(address account) public view returns (uint256)',
      'function transfer(address to, uint256 value) public returns (bool)',
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);
    const erc20Tokens = tokens.filter(
      (t) => t.address.toLowerCase() !== zeroAddress.toLowerCase()
    );
    // extract token include into `coinsList`
    const calls = erc20Tokens.map((token) => ({
      address: token.address as `0x${string}`,
      functionName: 'balanceOf',
      args: [walletAddress],
    }));
    let results: (
      | {
          error: Error;
          result?: undefined;
          status: 'failure';
        }
      | {
          error?: undefined;
          result: string | number;
          status: 'success';
        }
    )[] = [];
    try {
      results = await client.multicall({
        contracts: calls.map((call) => ({
          ...call,
          abi,
        })),
        allowFailure: true,
      });
    } catch (error) {
      console.error('Error during multicall:', error);
    }
    // formating tokens
    const updatedTokens = results.map((result, index) => {
      const token = erc20Tokens[index];
      if (!result || result.status === 'failure') {
        // console.error(`Error getting balance for ${token.symbol}`);
        return null;
      }
      const balance = result.result?.toString() || '0';
      const tokenBalance = {
        ...token,
        chainId: String(token.chainId),
        balance: (Number(balance) / 10 ** token.decimals).toString(),
        balanceUSD: (
          (Number(balance) / 10 ** token.decimals) *
          Number(token.priceUSD || 0)
        ).toString(),
      };

      return Number(tokenBalance.balance) > 0 && tokenBalance.balanceUSD !== '0'
        ? tokenBalance
        : null;
    });
    const zeroToken = tokens.find(
      (t) => t.address.toLowerCase() === zeroAddress.toLowerCase()
    );
    // add call for Zero Token
    if (zeroToken) {
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
    }
    // Filter out null values & remove `aToken` and update the BehaviorSubject
    const validTokens = updatedTokens
      .filter((token) => token !== null)
      .filter((t) => !t.symbol.startsWith('a')) as TokenWithBalance[];
    this._tokens$.next([...this._tokens$.value, ...validTokens]);
    return validTokens;
  }

  async loadUserSummary(ops: { account: string }) {
    const userSummaries = new Map<
      number,
      FormatUserSummaryResponse<ReserveDataHumanized & FormatReserveUSDResponse>
    >();
    for (const chain of AVAILABLE_CHAINS) {
      const market = [
        markets.AaveV3Arbitrum,
        markets.AaveV3ArbitrumSepolia,
        markets.AaveV3Avalanche,
        // markets.AaveV3BNB,
        markets.AaveV3Ethereum,
        markets.AaveV3Base,
        markets.AaveV3BaseSepolia,
        markets.AaveV3Polygon,
        markets.AaveV3Gnosis,
        markets.AaveV3Optimism,
        markets.AaveV3Scroll,
        markets.AaveV3Sonic,
        markets.AaveV3ZkSync,
      ].find((market) => market.CHAIN_ID === chain.id);
      if (!market) {
        continue;
      }
      const currentAccount = ops.account;
      const provider = new providers.JsonRpcProvider(
        chain.rpcUrls.default.http[0]
      );
      const poolDataProviderContract = new UiPoolDataProvider({
        uiPoolDataProviderAddress: market.UI_POOL_DATA_PROVIDER,
        provider,
        chainId: chain.id,
      });
      const userReserves =
        await poolDataProviderContract.getUserReservesHumanized({
          lendingPoolAddressProvider: market.POOL_ADDRESSES_PROVIDER,
          user: currentAccount,
        });
      const reserves = await poolDataProviderContract.getReservesHumanized({
        lendingPoolAddressProvider: market.POOL_ADDRESSES_PROVIDER,
      });
      const reservesArray = reserves.reservesData;
      const baseCurrencyData = reserves.baseCurrencyData;
      const userReservesArray = userReserves.userReserves;
      const currentTimestamp = dayjs().unix();
      const formattedReserves = formatReserves({
        reserves: reservesArray,
        currentTimestamp,
        marketReferenceCurrencyDecimals:
          baseCurrencyData.marketReferenceCurrencyDecimals,
        marketReferencePriceInUsd:
          baseCurrencyData.marketReferenceCurrencyPriceInUsd,
      });
      const userSummary = formatUserSummary({
        currentTimestamp,
        marketReferencePriceInUsd:
          baseCurrencyData.marketReferenceCurrencyPriceInUsd,
        marketReferenceCurrencyDecimals:
          baseCurrencyData.marketReferenceCurrencyDecimals,
        userReserves: userReservesArray,
        formattedReserves,
        userEmodeCategoryId: userReserves.userEmodeCategoryId,
      });
      // add to user summaries
      userSummaries.set(chain.id, { ...userSummary });
    }
    // get all tokens added as liquidity from userSummary
    const userTokensAsLiquidity: TokenWithBalance[] = [];
    for (const [chainId, userSummary] of userSummaries.entries()) {
      const tokens = userSummary.userReservesData
        .map((reserve) => {
          const token = {
            address: reserve.reserve.aTokenAddress,
            symbol: reserve.reserve.symbol,
            chainId: String(chainId),
            balance: reserve.underlyingBalance,
            balanceUSD: reserve.underlyingBalanceUSD,
            priceUSD: reserve.reserve.priceInUSD,
            name: reserve.reserve.name,
            decimals: reserve.reserve.decimals,
            isDepositAsCollateral: reserve.usageAsCollateralEnabledOnUser && reserve.underlyingBalance !== '0',
            isDepositAsLiquidity: !reserve.usageAsCollateralEnabledOnUser && reserve.underlyingBalance !== '0',
            isBorrowed: reserve.totalBorrowsUSD !== '0'
          };
          return token;
        })
        .filter((token) => token.balance !== '0' && token.balanceUSD !== '0');
      userTokensAsLiquidity.push(...tokens);
    }
    // add to tokens$
    console.log('userTokensAsLiquidity', userTokensAsLiquidity);
    const currentTokens = this._tokens$.value;
    this._tokens$.next([
      ...currentTokens,
      ...userTokensAsLiquidity
    ]);
    return userSummaries;
  }
}
