type ChainId = string;

export interface BaseToken {
  chainId: ChainId;
  address: string;
}

export interface StaticToken extends BaseToken {
  symbol: string;
  decimals: number;
  name: string;
  coingeckoId?: string;
  logoURI?: string;
}

export interface Token extends StaticToken {
  priceUSD: string
}

export interface TokenWithBalance extends Token {
  balance: string;
  balanceUSD: string;
}

export interface GroupedTokenWithBalance extends Omit<TokenWithBalance, 'address' | 'chainId' | 'decimals'> {
  tokens?: TokenWithBalance[];
}

export interface TokenMarketData {
  '24h_change'?: number;
  '7d_change'?: number;
  '30d_change'?: number;
  '1h_change'?: number;
  sparkline7d?: any;
  circulatingSupply?: number;
  marketCap?: number;
  fdv?: number;
  maxSupply?: number;
  totalSupply?: number;
  logoURI?: string;
  coingeckoId?: string;
  priceUSD?: string;
  symbol: string;
}

export interface TokenAverage {
  averageCost?: number;
  totalCost?: number;
  plPercentage?: number;
  plDollars?: number;
}

export interface GroupedTokenWithBalanceAndMarketData extends GroupedTokenWithBalance, TokenMarketData, TokenAverage {
  coingeckoId?: string;
  priceUSD: string;
}
