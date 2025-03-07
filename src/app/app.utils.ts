import { CoingeckoService } from './services/coingecko/coingecko.service';
import { TokenState } from './services/lifi/lifi.service';

import { assets, chains } from 'chain-registry';
import { bech32 } from 'bech32';
import {
  TokenMarketData,
  TokenWithBalance,
} from './interfaces/token';
import { TxDetail } from './interfaces/tx';
import { PublicKey } from '@solana/web3.js';


export const formatDataForChart = (
  data: number[]
): { time: number; value: number }[] => {
  const interval = 1000 * 60 * 30; // Intervalle de 30 minutes en millisecondes
  const now = new Date();

  // Ajuster le startTime à la prochaine heure pleine ou demi-heure
  const minutes = now.getMinutes();
  const nextHalfHour = minutes < 30 ? 30 : 60;
  now.setMinutes(nextHalfHour, 0, 0);
  const startTime = now.getTime() - interval * (data.length - 1);

  return data.map((value, index) => {
    const time = new Date(startTime + interval * index).getTime();
    return { time, value };
  });
};

export function isValidSvmAddress(address: string): boolean {
  try {
    const publicKey = new PublicKey(address);
    return PublicKey.isOnCurve(publicKey.toBytes());
  } catch (error) {
    return false;
  }
}

export function getAssetConversionFactor(denom: string): number {
  const asset = getCosmosAssetInfo(denom);
  if (asset) {
    const denomUnit = asset.denom_units?.[1] || asset.denom_units?.[0];
    if (denomUnit) {
      return denomUnit.exponent === 0 ? 6 : denomUnit.exponent;
    }
  }
  return 6; // Valeur par défaut si aucune information n'est trouvée
}

export const getCosmosAssetInfo = (denom: string) => {
  const asset = assets.flatMap((a) => a.assets)?.find((a) => a.base === denom);
  return asset;
};

export function convertCosmosAddress(
  cosmosAddress: string,
  targetPrefix: string
): string {
  const decoded = bech32.decode(cosmosAddress);
  return bech32.encode(targetPrefix, decoded.words);
}

export function getIBCPrefix(chainName: string): string | undefined {
  const chain = chains.find(
    (c) =>
      c.chain_name?.toLowerCase() === chainName?.toLowerCase() ||
      c.chain_id?.toLowerCase().includes(chainName?.toLowerCase())
  );
  return chain?.bech32_prefix;
}

export function convertIBCAmount(amount: string, denom: string): number {
  const factor = getAssetConversionFactor(denom);
  return Number(amount) / Math.pow(10, factor);
}

// export const groupByTicker = (
//   txs: Tx[]
// ): Record<string, AssetPosition & { txs: Tx[] }> => {
//   return txs.reduce((acc, tx) => {
//     const tickerId = tx.tickerId.toLocaleUpperCase();
//     if (!acc[tickerId]) {
//       acc[tickerId] = {
//         tickerId,
//         units: 0,
//         price: 0,
//         '24h_change': 0,
//         total: 0,
//         averageCost: 0,
//         plDollars: 0,
//         plPercentage: 0,
//         txs: [],
//       };
//     }
//     const asset = acc[tickerId];
//     asset.units += tx.quantity;
//     asset.txs.push(tx);
//     return acc;
//   }, {} as Record<string, AssetPosition & { txs: Tx[] }>);
// };

// export const addMarketDatas = async <T>(
//   assetPositions: (T & AssetPosition)[],
//   {
//     _coinsService,
//     _db,
//     refresh = false,
//   }: {
//     _coinsService: CoinsService;
//     _db: DBService;
//     refresh?: boolean;
//   }
// ) => {
//   const manualIds = [
//     { tickerId: 'btc', apiId: 'bitcoin' },
//     { tickerId: 'eth', apiId: 'ethereum' },
//     { tickerId: 'jup', apiId: 'jupiter-exchange-solana' },
//     { tickerId: 'velo', apiId: 'velodrome-finance' },
//     { tickerId: 'op', apiId: 'optimism' },
//     { tickerId: 'hype', apiId: 'hyperliquid' },
//   ];
//   const tickerIds = assetPositions.map((asset) => asset.tickerId);
//   const coinsList = await _coinsService.getAllCoinsId();
//   const coinTickerIds = tickerIds
//     .map((tickerId) => {
//       const ticket = manualIds.find(
//         (manualId) =>
//           manualId.tickerId.toLocaleLowerCase() === tickerId.toLocaleLowerCase()
//       );
//       if (ticket) {
//         return ticket.apiId;
//       } else {
//         return coinsList.find(
//           (coin: { symbol: string }) =>
//             coin.symbol.toLocaleLowerCase() === tickerId.toLocaleLowerCase()
//         )?.id;
//       }
//     })
//     .filter(Boolean) as string[];
//   // replace `btc` tickerId by `bitcoin`
//   const index = coinTickerIds.indexOf('btc');
//   if (index > -1) {
//     coinTickerIds[index] = 'bitcoin';
//   }
//   const marketData = await _coinsService.getDataMarket(coinTickerIds, refresh);
//   for (const asset of assetPositions) {
//     const assetMarketData = marketData?.find(
//       (market: { symbol: string }) =>
//         market.symbol.toLocaleLowerCase() === asset.tickerId.toLocaleLowerCase()
//     );
//     if (assetMarketData) {
//       asset.price = assetMarketData.current_price;
//       asset['24h_change'] = assetMarketData.price_change_percentage_24h;
//       asset.total = asset.price * asset.units;
//       asset.averageCost = await new AveragePipe(_db).transform(asset);
//       asset.plDollars = await new PLPipe(_db).transform(asset);
//       asset.logo = assetMarketData.image;
//       asset.sparkline7d = assetMarketData.sparkline_in_7d;
//       asset['1h_change'] =
//         assetMarketData.price_change_percentage_1h_in_currency;
//       asset['7d_change'] =
//         assetMarketData.price_change_percentage_7d_in_currency;
//       asset['30d_change'] =
//         assetMarketData.price_change_percentage_30d_in_currency;
//       asset.circulatingSupply = assetMarketData.circulating_supply;
//       asset.marketCap = assetMarketData.market_cap;
//       asset.fdv = assetMarketData.fully_diluted_valuation;
//       asset.maxSupply = assetMarketData.max_supply;
//       asset.totalSupply = assetMarketData.total_supply;

//       const initialInverstmentWorth = asset.averageCost * asset.units;
//       asset.plPercentage = new CalculPercentPipe().transform(
//         asset.plDollars,
//         initialInverstmentWorth
//       );
//     }
//   }
//   return assetPositions;
// };

export const addMarketDatasFromCoingecko = async (
  _coinsService: CoingeckoService,
  assets: TokenWithBalance[],
  forceRefresh?: boolean
): Promise<TokenMarketData[]> => {
  const manualIds = [
    { tickerId: 'btc', apiId: 'bitcoin' },
    { tickerId: 'eth', apiId: 'ethereum' },
    { tickerId: 'jup', apiId: 'jupiter-exchange-solana' },
    { tickerId: 'velo', apiId: 'velodrome-finance' },
    { tickerId: 'op', apiId: 'optimism' },
    { tickerId: 'hype', apiId: 'hyperliquid' },
    { tickerId: 'ape', apiId: 'apecoin' },
  ];
  const tickerSymbols = assets
    .filter((asset) => !asset.coingeckoId || asset.coingeckoId !== 'null')
    .map((asset) => asset.symbol);
  const tickerIds = assets
    .filter((asset) => asset.coingeckoId || asset.coingeckoId !== 'null')
    .map((asset) => asset.coingeckoId).filter(Boolean) as string[];
  const coinsList = await _coinsService.getAllCoinsId();
  const coinSymbolsIds = tickerSymbols
    .map((tickerId) => {
      const ticket = manualIds.find(
        (manualId) =>
          manualId.tickerId.toLocaleLowerCase() === tickerId.toLocaleLowerCase()
      );
      if (ticket) {
        return ticket.apiId;
      } else {
        return coinsList.find(
          (coin: { symbol: string }) =>
            coin.symbol.toLocaleLowerCase() === tickerId.toLocaleLowerCase()
        )?.id;
      }
    })
    .filter(Boolean) as string[];
  // replace `btc` tickerId by `bitcoin`
  const index = coinSymbolsIds.indexOf('btc');
  if (index > -1) {
    coinSymbolsIds[index] = 'bitcoin';
  }
  const coingeckoIds = new Set([
    ...coinSymbolsIds,
    ...tickerIds,
  ]);
  
  const marketData = await _coinsService.getDataMarket(
    [...coingeckoIds.values()],
    forceRefresh
  );
  const tokensMarketData: TokenMarketData[] = assets.map((asset) => {
    const assetMarketData = marketData?.find(
      (market: { symbol: string }) =>
        market.symbol.toLocaleLowerCase() === asset.symbol.toLocaleLowerCase()
    );
    return {
      priceUSD: assetMarketData?.current_price,
      '24h_change': assetMarketData?.price_change_percentage_24h,
      '1h_change': assetMarketData?.price_change_percentage_1h_in_currency,
      '7d_change': assetMarketData?.price_change_percentage_7d_in_currency,
      '30d_change': assetMarketData?.price_change_percentage_30d_in_currency,
      sparkline7d: assetMarketData?.sparkline_in_7d,
      circulatingSupply: assetMarketData?.circulating_supply,
      marketCap: assetMarketData?.market_cap,
      fdv: assetMarketData?.fully_diluted_valuation,
      maxSupply: assetMarketData?.max_supply,
      totalSupply: assetMarketData?.total_supply,
      logoURI: assetMarketData?.image,
      symbol: asset.symbol,
      coingeckoId: asset.coingeckoId || assetMarketData?.id,
    };
  });
  return tokensMarketData;
};

interface TokenAverageCost {
  [tokenSymbol: string]: TokenState;
}

export const calculateAverageCosts = (txs: TxDetail[]): TokenAverageCost => {
  const tokenStates: TokenAverageCost = {};

  const operationTypeToCalculate = ['trade', 'send', 'receive', 'mint'];
  txs.forEach((tx) => {
    const { operation_type = '', transfers = [] } = tx.attributes || {};
    if (!operationTypeToCalculate.includes(operation_type)) {
      return;
    }
    transfers.forEach((transfer) => {
      const { fungible_info, direction, quantity, value } = transfer;
      const symbol = fungible_info?.symbol;

      if (!symbol) {
        return;
      }

      if (!tokenStates[symbol]) {
        tokenStates[symbol] = {
          totalQuantity: 0,
          totalCost: 0,
          averageCost: 0,
          txs: [],
        };
      }
      const state = tokenStates[symbol];
      if (!state.totalQuantity) {
        state.totalQuantity = 0;
      }
      if (!state.totalCost) {
        state.totalCost = 0;
      }
      if (!state.averageCost) {
        state.averageCost = 0;
      }

      // const quantityFloat = Number.isNaN(quantity?.float)
      //   ? 0
      //   : quantity?.float;
      // const valueNumber = Number.isNaN(value) ? 0 : value || 0;

      // if (direction === 'in' && quantityFloat && valueNumber) {
      //   // Achat ou réception
      //   state.totalQuantity += quantityFloat;
      //   state.totalCost += valueNumber;
      // }
      // if (direction === 'out' && quantityFloat) {
      //   // Vente ou envoi
      //   state.totalQuantity -= quantityFloat;
      //   state.totalCost -= valueNumber;
      // }
      // Recalculer le coût moyen
      state.averageCost =
        state.totalQuantity > 0 ? state.totalCost / state.totalQuantity : 0;
      // Ajouter la transaction
      state.txs.push({
        ...transfer,
        minedAt: tx.attributes.mined_at,
        operationType: tx.attributes.operation_type,
      });
    });
  });
  // calculate totalQuantity totalCost averageCost for all items based on txs array
  const calculateTotal = (state: TokenState) => {
    state.totalQuantity = state.txs.reduce((acc, tx) => {
      const { fungible_info, direction, quantity } = tx;
      const quantityFloat = Number.isNaN(quantity?.float) ? 0 : quantity?.float;
      if (direction === 'in') {
        return acc + quantityFloat;
      }
      if (direction === 'out') {
        return acc - quantityFloat;
      }
      return acc;
    }, 0);
    state.totalCost = state.txs.reduce((acc, tx) => {
      const { fungible_info, direction, value } = tx;
      const valueNumber = Number.isNaN(value) ? 0 : value || 0;
      if (direction === 'in') {
        return acc + valueNumber;
      }
      if (direction === 'out') {
        return acc - valueNumber;
      }
      return acc;
    }, 0);
    state.averageCost =
      state.totalQuantity > 0 ? state.totalCost / state.totalQuantity : 0;
    return state;
  };
  for (const symbol in tokenStates) {
    tokenStates[symbol] = calculateTotal(tokenStates[symbol]);
  }
  return tokenStates;
};

// export const getTotalWalletWorth = (assetPositions: AssetPosition[]) => {
//   return assetPositions.reduce((acc, asset) => acc + asset.total, 0);
// };

// export const getTotalStableWorth = (assetPositions: AssetPosition[]) => {
//   const stalbe = assetPositions.filter(
//     (asset) =>
//       asset.tickerId === 'USDT' ||
//       asset.tickerId === 'USDC' ||
//       asset.tickerId === 'DAI' ||
//       asset.tickerId === 'TUSD' ||
//       asset.tickerId === 'BUSD' ||
//       asset.tickerId === 'GO'
//   );
//   return stalbe.reduce((acc, asset) => acc + asset.total, 0);
// };

// export const getTotaltPL = (assetPositions: AssetPosition[]) => {
//   return assetPositions.reduce(
//     (acc, asset) => acc + (Number(asset.plDollars) || 0),
//     0
//   );
// };

// export const isStableTicker = (tickerId: string) => {
//   const stableTicker = [
//     'USDT',
//     'USDC',
//     'DAI',
//     'TUSD',
//     'BUSD',
//     'USDP',
//     'USDN',
//     'PAX',
//     'HUSD',
//     'GUSD',
//     'SUSD',
//     'UST',
//     'mUSD',
//     'sUSD',
//     'LUSD',
//     'MUSD',
//     'CUSD',
//     'RUSD',
//     'USD',
//     'EURS',
//     'USDS',
//     'USDx',
//     'USDc',
//     'USDG',
//     'USDQ',
//     'USDJ',
//     'USDs',
//     'USDt',
//     'USDx',
//     'USD++',
//   ];
//   const isStableTicker = stableTicker.includes(tickerId);
//   return isStableTicker;
// };

// export const formatDataForChart = (
//   data: number[]
// ): { time: number; value: number }[] => {
//   const interval = 1000 * 60 * 30; // Intervalle de 30 minutes en millisecondes
//   const now = new Date();

//   // Ajuster le startTime à la prochaine heure pleine ou demi-heure
//   const minutes = now.getMinutes();
//   const nextHalfHour = minutes < 30 ? 30 : 60;
//   now.setMinutes(nextHalfHour, 0, 0);
//   const startTime = now.getTime() - interval * (data.length - 1);

//   return data.map((value, index) => {
//     const time = new Date(startTime + interval * index).getTime();
//     return { time, value };
//   });
// };
