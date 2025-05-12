import * as CHAINS from 'viem/chains';

export const AVAILABLE_CHAINS = [
  {
    ...CHAINS.mainnet,
    chainKey: 'ethereum',
    logoURI: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    type: 'evm',
  },
  {
    ...CHAINS.optimism,
    chainKey: 'optimism',
    logoURI: `${CHAINS.optimism.blockExplorers.default.url}/assets/optimism/images/svg/logos/chain-light.svg`,
    type: 'evm',
  },
  {
    ...CHAINS.arbitrum,
    chainKey: 'arbitrum',
    logoURI: `${CHAINS.arbitrum.blockExplorers.default.url}/assets/arbitrum/images/svg/logos/chain-light.svg`,
    type: 'evm',
  },
  {
    ...CHAINS.polygon,
    chainKey: 'polygon',
    logoURI: `${CHAINS.polygon.blockExplorers.default.url}/assets/poly/images/svg/logos/chain-light.svg`,
    type: 'evm',
  },
  // CHAINS.bsc,
  {
    ...CHAINS.avalanche,
    chainKey: 'avalanche',
    logoURI: `https://cdn.routescan.io/cdn/chains/avax/avax-icon.svg`,
    type: 'evm',
  },
  {
    ...CHAINS.base,
    chainKey: 'base',
    logoURI: `${CHAINS.base.blockExplorers.default.url}/assets/base/images/svg/logos/chain-light.svg`,
    type: 'evm',
  },
  {
    ...CHAINS.zksync,
    chainKey: 'zksync',
    logoURI: `${CHAINS.zksync.blockExplorers.default.url}/assets/zksync/images/svg/logos/chain-light.svg`,
    type: 'evm',
  },
  {
    ...CHAINS.scroll,
    chainKey: 'scroll',
    logoURI: `${CHAINS.scroll.blockExplorers.default.url}/assets/scroll/images/svg/logos/chain-light.svg`,
    type: 'evm',
  },
  {
    ...CHAINS.gnosis,
    chainKey: 'gnosis',
    logoURI: `${CHAINS.gnosis.blockExplorers.default.url}/assets/xdai/images/svg/logos/chain-light.svg`,
    type: 'evm',
  },
  {
    ...CHAINS.polygonZkEvm,
    chainKey: 'polygonZkEvm',
    logoURI: `${CHAINS.polygonZkEvm.blockExplorers.default.url}/assets/zkpoly/images/svg/logos/chain-light.svg`,
    type: 'evm',
  },
  // CHAINS.sei,
  {
    ...CHAINS.abstract,
    chainKey: 'abstract',
    logoURI: `${CHAINS.abstract.blockExplorers.default.url}/assets/abstract/images/svg/logos/chain-light.svg`,
    type: 'evm',
  },
  // CHAINS.metis,
  // CHAINS.blast,
  // CHAINS.linea,
  // CHAINS.fantom,
  // CHAINS.sonic,
  // CHAINS.mode,
  {
    ...CHAINS.unichain,
    chainKey: 'unichain',
    logoURI: `${CHAINS.unichain.blockExplorers.default.url}/assets/uni/images/svg/logos/chain-light.svg`,
    type: 'evm',
  },
  // CHAINS.celo,
  // CHAINS.mantle,
  {
    ...CHAINS.berachain,
    chainKey: 'berachain',
    logoURI: `${CHAINS.berachain.blockExplorers.default.url}/assets/bera/images/svg/logos/chain-light.svg`,
    type: 'evm',
  },
  {
    id: 999,
    name: 'Hyperliquid EVM',
    rpcUrls: {
      default: {
        http: ['https://rpc.hyperliquid.xyz/evm'],
      },
    },
    nativeCurrency: {
      name: 'Hyperliquid',
      symbol: 'HYPE',
      decimals: 18,
    },
    chainKey: 'hyperliquid',
    logoURI: 'https://purrsec.com/products/hyperliquid/logo-light.png',
    type: 'evm',
  },
  {
    id: -999,
    name: 'Hyperliquid Core',
    rpcUrls: {
      default: {
        http: [''],
      },
    },
    nativeCurrency: {
      name: 'Hyperliquid',
      symbol: 'HYPE',
      decimals: 18,
    },
    chainKey: 'hyperliquid-core',
    logoURI: 'https://purrsec.com/products/hyperliquid/logo-light.png',
    type: 'core',
  },
];
