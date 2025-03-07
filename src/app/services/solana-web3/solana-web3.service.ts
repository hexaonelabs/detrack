import { Injectable } from '@angular/core';
import { TokenWithBalance } from '../../interfaces/token';
import { BehaviorSubject } from 'rxjs';
import {
  ChainType,
  getTokenBalance,
  getTokenBalances,
  getTokens,
  Token,
} from '@lifi/sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
// import { Metaplex, tokenModule } from '@metaplex-foundation/js';

@Injectable({
  providedIn: 'root',
})
export class SolanaWeb3Service {
  private readonly _tokens$: BehaviorSubject<TokenWithBalance[]> =
    new BehaviorSubject([] as TokenWithBalance[]);
  public readonly tokens$ = this._tokens$.asObservable();

  async clear() {
    this._tokens$.next([]);
  }
  
  async getWalletTokens(walletAddress: `${string}`): Promise<void> {
    // const tokensResponse = await getTokens({
    //   chainTypes: [ChainType.SVM],
    // });
    // this._tokens$.next([]);
    // for (const chainId in tokensResponse.tokens) {
    //   const tokens = tokensResponse.tokens[Number(chainId)];
    //   await this._getAccountTokensBalance(tokens, walletAddress);
    // }
    this._getTokensWithWeb3(walletAddress);
  }

  private async _getAccountTokensBalance(
    chainTokens: Token[],
    accountAddress: string
  ): Promise<void> {
    chainTokens.forEach(async (token) => {
      const tokenData = await getTokenBalance(accountAddress, token);
      console.log('>>>', tokenData);
      if (!tokenData) {
        return;
      }
      const t: TokenWithBalance = {
        chainId: token.chainId.toString(),
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        name: token.name,
        priceUSD: token.priceUSD,
        balance: tokenData.amount?.toString() || '-1',
        logoURI: token.logoURI || '',
        balanceUSD: (
          Number(token.priceUSD) * Number(tokenData.amount)
        ).toString(),
      };
      this._tokens$.next([...this._tokens$.value, t]);
    });
  }

  private async _getTokensWithWeb3(walletAddress: string) {
    const connection = new Connection('https://solana-rpc.publicnode.com'); // URL du cluster
    const publicKey = new PublicKey(walletAddress);

    // Récupérer tous les comptes associés au wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), // Program ID pour les tokens SPL
      }
    );
    console.log('all tokenAccounts: ', tokenAccounts);

    tokenAccounts.value.forEach(async (accountInfo) => {
      const accountData = accountInfo.account.data.parsed.info;
      // console.log(`accountData: ${accountData}`);
      console.log(`Token Mint: ${accountData.mint}`);
      // console.log(`Balance: ${accountData.tokenAmount.uiAmount}`);
      if (accountData.tokenAmount.uiAmount <= 0) return;
      await this._getTokenInfo(accountData.mint);
      // await this._getTokenMetadata(accountData.mint);
    });
  }

  private async _getTokenInfo(mintAddress: string) {
    const connection = new Connection('https://solana-rpc.publicnode.com'); // Cluster Mainnet
    // const mintPublicKey = new PublicKey(mintAddress);
    const metadataPDA = (
      PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
          new PublicKey(mintAddress).toBuffer(),
        ],
        new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s') // Metaplex Metadata Program ID
      )
    )[0];
    const accountInfo = await connection.getAccountInfo(metadataPDA);
    if (accountInfo) {
      const metadata = accountInfo.data.toString('utf-8');
      console.log('Raw Metadata:', accountInfo);
    }
  }
}
