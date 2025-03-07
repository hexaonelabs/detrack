import { Injectable } from '@angular/core';
import { Coin, StargateClient } from '@cosmjs/stargate';
import {
  convertCosmosAddress,
  convertIBCAmount,
  getAssetConversionFactor,
  getCosmosAssetInfo,
  getIBCPrefix,
} from '../../app.utils';
import { BehaviorSubject, map } from 'rxjs';
import { Token, TokenWithBalance } from '../../interfaces/token';

@Injectable({
  providedIn: 'root',
})
export class StargateService {
  private readonly _tokens$: BehaviorSubject<TokenWithBalance[]> =
    new BehaviorSubject([] as TokenWithBalance[]);
  public readonly tokens$ = this._tokens$.asObservable();
  private readonly _totalTokenToCheck$ = new BehaviorSubject(0);
  public readonly isAllTokenSymbolLoaded$ = this._totalTokenToCheck$.asObservable().pipe(
    map((total) => total <= 0)
  );

  async clear() {
    this._tokens$.next([]);
  }
  
  async getWalletTokens(walletAddress: `cosmos${string}`): Promise<void> {
    const chains = [
      { id: 'cosmoshub-4', rpc: 'https://cosmos-rpc.publicnode.com:443' },
      {
        id: 'osmosis-1',
        rpc: 'https://osmosis-rpc.publicnode.com:443',
        address: convertCosmosAddress(
          walletAddress,
          `${getIBCPrefix('osmosis')}`
        ),
      },
    ];
    const balances = await this.getTokenBalances(walletAddress, chains);
    this._tokens$.next([
      ...this._tokens$.value,
      ...balances,
    ]);
  }

  async getTokenBalances(
    cosmosAddress: string,
    chains: { id: string; rpc: string; address?: string }[]
  ) {
    const balances: { chainId: string; tokens: Coin[] }[] = [];
    const tokensWithBalance: TokenWithBalance[] = [];
    for (const chain of chains) {
      try {
        const client = await StargateClient.connect(chain.rpc);
        const accountBalance = await client.getAllBalances(
          chain.address || cosmosAddress
        );
        balances.push({ chainId: chain.id, tokens: [...accountBalance] });
      } catch (error) {
        console.error(
          `Erreur lors de la récupération des soldes pour ${chain.id}:`,
          error
        );
      }
    }
    // update total token to check
    this._totalTokenToCheck$.next(balances.length);
    const ibcTokenRegistery: {
      [key: string]: { origin: { denom: string }; hash: string; chain: string };
    } = await fetch(
      'https://raw.githubusercontent.com/PulsarDefi/IBC-Token-Data-Cosmos/refs/heads/main/ibc_data.json'
    ).then((response) => response.json());
    const nativeCosmosHubRegistery: {
      [key: string]: {
        denom: string;
        chain: string;
        symbol: string;
        decimals: number;
        coingecko_id: string;
        logos?: { png?: string };
      };
    } = await fetch(
      'https://raw.githubusercontent.com/PulsarDefi/IBC-Token-Data-Cosmos/refs/heads/main/native_token_data.json'
    ).then((response) => response.json());
    // loop over each balance to get token data info
    for (const balance of balances) {
      balance.tokens.forEach((token) => {
        const ibcToken =
          ibcTokenRegistery[token.denom + '__' + balance.chainId.split('-')[0]];
        const nativeToken =
          nativeCosmosHubRegistery[
            token.denom + '__' + balance.chainId.split('-')[0]
          ];
        if (ibcToken) {
          const {
            address = token.denom,
            symbol,
            display,
            name,
            coingecko_id: coingeckoId,
            logo_URIs,
            denom_units
          } = getCosmosAssetInfo(ibcToken.origin.denom) || {};
          // create token data object
          const tokenData: Token = {
            chainId: balance.chainId,
            address,
            symbol: `${symbol || name || display || ibcToken.origin.denom}`,
            priceUSD: '-1',
            name: `${symbol || name || display || ibcToken.origin.denom}`,
            decimals: getAssetConversionFactor(ibcToken.origin.denom),
            coingeckoId,
            logoURI: logo_URIs?.png || logo_URIs?.svg,
          };
          // add token to the list
          tokensWithBalance.push({
            ...tokenData,
            balanceUSD: '-1',
            balance: convertIBCAmount(
              token.amount,
              ibcToken.origin.denom
            ).toString(),
          });
        } 
        else if (nativeToken) {
          const tokenData: Token = {
            chainId: balance.chainId,
            address: token.denom,
            symbol: nativeToken.symbol,
            priceUSD: '-1',
            name: nativeToken.symbol,
            decimals: nativeToken.decimals,
            coingeckoId: nativeToken.coingecko_id,
            logoURI: nativeToken.logos?.png,
          };
          tokensWithBalance.push({
            ...tokenData,
            balanceUSD: '-1',
            balance: convertIBCAmount(
              token.amount,
              token.denom
            ).toString(),
          });
        }
        // decrease totalTokenToCheck
        this._totalTokenToCheck$.next(this._totalTokenToCheck$.value - 1);
      });
    }
    return tokensWithBalance;
  }

}

// import { createProtobufRpcClient, QueryClient } from "@cosmjs/stargate";
// import { QueryClientImpl } from "cosmjs-types/cosmos/bank/v1beta1/query";
// import { Tendermint34Client } from "@cosmjs/tendermint-rpc";

// const getBalance = async (denom: string, address: string, rcp: string): Promise<Coin | undefined> => {
//     try {
//       const tendermint = await Tendermint34Client.connect(rcp);
//       const queryClient = new QueryClient(tendermint);
//       const rpcClient = createProtobufRpcClient(queryClient);
//       const bankQueryService = new QueryClientImpl(rpcClient);

//       const { balance } = await bankQueryService.Balance({
//         address,
//         denom,
//       });

//       return balance;
//     } catch (error) {
//       console.log(error);
//     }
//   };
