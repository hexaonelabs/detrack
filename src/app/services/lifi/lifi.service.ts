import { Injectable } from '@angular/core';
import { getTokens, Token } from '@lifi/sdk';
import {
  BehaviorSubject,
  map,
  tap,
} from 'rxjs';
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

export interface TokenState {
  totalQuantity: number;
  totalCost: number;
  averageCost: number;
  txs: any[];
}

const AVAILABLE_CHAINS = [
  CHAINS.mainnet,
  CHAINS.bsc,
  CHAINS.polygon,
  CHAINS.optimism,
  CHAINS.arbitrum,
  CHAINS.avalanche,
  CHAINS.base,
  CHAINS.zksync,
  CHAINS.scroll,
  CHAINS.gnosis,
  CHAINS.polygonZkEvm,
  CHAINS.sei,
  CHAINS.abstract,
  CHAINS.metis,
  CHAINS.blast,
  CHAINS.linea,
  CHAINS.fantom,
  CHAINS.sonic,
  CHAINS.mode,
  CHAINS.unichain,
  CHAINS.celo,
  CHAINS.mantle,
  CHAINS.berachain,
];

@Injectable({
  providedIn: 'root',
})
export class LIFIService {
  private readonly _tokens$: BehaviorSubject<TokenWithBalance[]> =
    new BehaviorSubject([] as TokenWithBalance[]);
  public readonly tokens$ = this._tokens$.asObservable();
  private readonly _totalTokenToCheck$ = new BehaviorSubject(0);
  public readonly isAllTokenSymbolLoaded$ = this._totalTokenToCheck$.asObservable().pipe(
    tap((total) => console.log('_totalTokenToCheck:', total)),
    map((total) => total <= 0)
  );

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
      const tokens = tokensResponse.tokens[Number(chainId)];
      this._getAccountTokensBalance(tokens, walletAddress);
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
    chainTokens: Token[],
    accountAddress: `0x${string}`
  ): Promise<void> {
    // const coinsList = await this._coinsService.getTop1000Coins();
    try {
      const CHAIN_ID = chainTokens[0].chainId;
      const abi = parseAbi([
        'function name() public view returns (string memory)',
        'function symbol() view returns (string memory)',
        'function decimals() view returns (uint8)',
        'function balanceOf(address account) public view returns (uint256)',
        'function transfer(address to, uint256 value) public returns (bool)',
        'event Transfer(address indexed from, address indexed to, uint256 value)',
      ]);
      const read = createPublicClient({
        chain: Object.values(CHAINS).find((c) => c.id === CHAIN_ID),
        transport: http(),
        batch: { multicall: true },
      });
      const allERC20 = chainTokens.filter(
        (t) => t.address.toLowerCase() !== zeroAddress.toLowerCase()
      );
      // extract token include into `coinsList`
      const erc20Tokens = allERC20;

      for (const token of erc20Tokens) {
        try {
          const contract = getContract({
            address: token.address as `0x${string}`,
            abi,
            client: { public: read },
          });
          contract.read
            ?.balanceOf([accountAddress])
            ?.then((b) => {
              const balance = b?.toString() || '0';
              const tokenBalance = {
                ...token,
                chainId: String(token.chainId),
                // return balance as decimal string
                balance: (Number(balance) / 10 ** token.decimals).toString(),
                balanceUSD:
                  ((Number(balance) / 10 ** token.decimals) *
                    Number(token.priceUSD) || 0).toString(),
              };
              if (Number(tokenBalance.balance) > 0) {
                this._tokens$.next([...this._tokens$.value, tokenBalance]);
              }
              // decrease totalTokenToCheck
              this._totalTokenToCheck$.next(this._totalTokenToCheck$.value - 1);
            })
            .catch((error) => {
              console.error(
                `Error getting balance for ${token.symbol}: `
                // error?.message
              );
              // decrease totalTokenToCheck
              this._totalTokenToCheck$.next(this._totalTokenToCheck$.value - 1);
            });
        } catch (error) {
          // console.error(error);
        }
      }
      // add zero token with corresponding balance
      const zeroToken = chainTokens.find(
        (t) => t.address.toLowerCase() === zeroAddress.toLowerCase()
      );
      if (zeroToken) {
        read
          .getBalance({ address: accountAddress })
          .then((b) => (Number(b) / 10 ** zeroToken.decimals).toString())
          .then((balance) => {
            const zeroTokenBalance = {
              ...zeroToken,
              chainId: String(zeroToken.chainId),
              balance,
              balanceUSD: (Number(balance) * Number(zeroToken.priceUSD)).toString(),
            };
            this._tokens$.next([...this._tokens$.value, zeroTokenBalance]);
            // decrease totalTokenToCheck
            this._totalTokenToCheck$.next(this._totalTokenToCheck$.value - 1);
          }).catch((error) => {
            // decrease totalTokenToCheck
            this._totalTokenToCheck$.next(this._totalTokenToCheck$.value - 1);
          });
      }
    } catch (error) {
      console.error(error);
    }
  }

  private async _getAAVEPoolUserReserveBalance(
    accountAddress: `0x${string}`
  ): Promise<void> {}
}
