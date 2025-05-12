import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CommonModule } from '@angular/common';
import {
  AlertController,
  IonApp,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonInput,
  IonRow,
  IonSpinner,
  IonText,
  LoadingController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addCircle, walletOutline, searchOutline } from 'ionicons/icons';
import { TokensListComponent } from './components/tokens-list/tokens-list.component';
import { TokenService } from './services/token/token.service';
import { ChartComponent } from './components/chart/chart.component';
import { BehaviorSubject, combineLatest, firstValueFrom, map } from 'rxjs';
import { FormsModule } from '@angular/forms';

const UIElements = [
  IonApp,
  IonContent,
  IonGrid,
  IonCol,
  IonRow,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonText,
  IonBadge,
  IonInput,
  IonChip,
  IonSpinner,
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    FormsModule,
    ...UIElements,
    TokensListComponent,
    ChartComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'detrack';
  public walletAddressInput: string | undefined;
  public readonly totalBorrowsUSD$;
  public readonly totalCollateralUSD$;
  public readonly tokens$;
  public readonly totalWorth$;
  public readonly totalWorthDetail$;
  public readonly history$;
  public readonly walletAddressList$ = new BehaviorSubject<string[]>([]);
  public readonly loadingMessage$ = new BehaviorSubject<string | undefined>(undefined);
  public readonly isLoading$ = new BehaviorSubject<boolean>(false);

  constructor(private readonly _dataService: TokenService) {
    addIcons({
      addCircle,
      walletOutline,
      searchOutline,
    });
    this.tokens$ = this._dataService.tokens$;
    this.totalBorrowsUSD$ = this._dataService.totalBorrowsUSD$;
    this.totalCollateralUSD$ = this._dataService.totalCollateralUSD$;
    this.totalWorth$ = combineLatest([
      this._dataService.balanceUSD$,
      this._dataService.totalLiquidityDeposit$,
    ]).pipe(
      map(([balanceUSD, totalLiquidityDeposit]) => {
        return balanceUSD + totalLiquidityDeposit;
      })
    );
    this.totalWorthDetail$ = combineLatest([
      this._dataService.balanceUSD$,
      this._dataService.totalBorrowsUSD$,
      this._dataService.totalCollateralUSD$,
      this._dataService.totalLiquidityDeposit$,
    ]).pipe(
      map(
        ([
          balanceUSD,
          totalBorrowsUSD,
          totalCollateralUSD,
          totalLiquidityDeposit,
        ]) => {
          return {
            totalWorthUSD: balanceUSD + totalLiquidityDeposit,
            totalCollateralUSD,
            totalBorrowsUSD,
            totalLiquidityDepositUSD: totalLiquidityDeposit,
            walletbalanceUSD: balanceUSD,
            totalBorrowPercent: totalBorrowsUSD
              ? (totalBorrowsUSD / (balanceUSD + totalLiquidityDeposit)) * 100
              : 0,
            totalCollateralPercent: totalCollateralUSD
              ? (totalCollateralUSD / (balanceUSD + totalLiquidityDeposit)) *
                100
              : 0,
          };
        }
      )
    );
    this.history$ = this._dataService.getPortfolioHistory$(30);
  }

  async ngOnInit() {
    const storedWalletAddressListJSON = localStorage.getItem(
      '__detrack_wallet_address__list__'
    );
    const storedWalletsAddress: string[] = storedWalletAddressListJSON
      ? JSON.parse(storedWalletAddressListJSON)
      : [];
    // check if wallet address list is empty
    if (!storedWalletsAddress.length) {
      return;
    }
    this.walletAddressInput = storedWalletsAddress[0];
    await this._loadData(storedWalletsAddress);
  }

  async fetchDatas() {
    // check if search input is empty
    if (!this.walletAddressInput || this.walletAddressInput.length < 3) {
      return;
    }
    // check if wallet address is already in the list
    const walletAddressList = this.walletAddressList$.getValue();
    if (walletAddressList.includes(this.walletAddressInput)) {
      const alert = await new AlertController().create({
        header: 'Wallet address already in the list',
        message: 'Please enter a different wallet address',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }
    // extract all existing addresses, add new address to the list
    // save to localstorage and then
    // call `this._loadData` to fetch data
    const walletsAddress = [...walletAddressList, this.walletAddressInput];
    // this.walletAddressInput = undefined;
    localStorage.setItem(
      '__detrack_wallet_address__list__',
      JSON.stringify(walletsAddress)
    );
    await this._loadData(walletsAddress);
  }

  private async _loadData(walletsAddress: string[]) {
    this.isLoading$.next(true);
    // update wallet address list
    this.walletAddressList$.next(walletsAddress);
    // load wallets tokens
    await this._dataService.clear();
    this.loadingMessage$.next('Loading Wallets tokens...');
    await this._dataService.getWalletsTokens(walletsAddress);
    this.loadingMessage$.next('Loading Wallets Loan positions...');
    await this._dataService.getLoanPositions(walletsAddress);
    this.loadingMessage$.next('Loading Market data...');
    await this._dataService.getTokensMarketData();
    this.isLoading$.next(false);
    this.loadingMessage$.next(undefined);
  }
}
