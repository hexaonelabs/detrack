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
  public walletAddress: string | undefined;
  public readonly totalBorrowsUSD$;
  public readonly totalCollateralUSD$;
  public readonly tokens$;
  public readonly totalWorth$;
  public readonly totalWorthDetail$;
  public readonly history$;
  public readonly walletAddressList$ = new BehaviorSubject<string[]>([]);

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
      map(([
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
          totalBorrowPercent:
            totalBorrowsUSD
              ? (totalBorrowsUSD / (balanceUSD + totalLiquidityDeposit)) * 100
              : 0,
          totalCollateralPercent: totalCollateralUSD
            ? (totalCollateralUSD / (balanceUSD + totalLiquidityDeposit)) * 100
            : 0,
        };
      })
    );
    this.history$ = this._dataService.getPortfolioHistory$(30);
  }

  async ngOnInit() {
    // const storedWalletAddressListJSON = localStorage.getItem('walletsAddress');
    // const storedWalletsAddress: string[] = storedWalletAddressListJSON
    //   ? JSON.parse(storedWalletAddressListJSON)
    //   : [];
    // const walletsAddress =
    //   storedWalletsAddress.length > 0
    //     ? storedWalletsAddress
    //     : await this._promptAccountList();
    // if (!walletsAddress) {
    //   const ionAlert = await new AlertController().create({
    //     header: 'Error',
    //     message: 'Please enter at least one wallet address',
    //     buttons: ['OK'],
    //   });
    //   await ionAlert.present();
    //   await ionAlert.onDidDismiss();
    //   this.ngOnInit();
    //   return;
    // }
    const address = localStorage.getItem('__detrack_wallet_address__');
    if (!address) {
      return;
    }
    this.walletAddress = address;
    await this._loadData([address]);
  }

  async fetchDatas() {
    if (!this.walletAddress) {
      return;
    }
    // save wallet address to local storage
    localStorage.setItem('__detrack_wallet_address__', this.walletAddress);
    // load data
    await this._loadData([this.walletAddress]);
  }

  async manageAccounts() {
    const list = await this._promptAccountList();
    if (!list) {
      return;
    }
    await this._loadData(list);
  }

  private async _promptAccountList() {
    const storedWalletAddressListJSON = localStorage.getItem('walletsAddress');
    const storedWalletsAddress: string[] = storedWalletAddressListJSON
      ? JSON.parse(storedWalletAddressListJSON)
      : [];

    const ionALert = await new AlertController().create({
      header: 'Wallet Address',
      message: 'Please enter EVM Wallet Address, separated by semicolon (;)',
      inputs: [
        {
          name: 'walletAddress',
          type: 'textarea',
          placeholder: '0x..., 0x...',
          // separate with ; and break line
          value: storedWalletsAddress.join(';\n'),
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Ok',
          role: 'ok',
        },
      ],
      backdropDismiss: false,
      keyboardClose: false,
    });
    await ionALert.present();
    const { data, role } = await ionALert.onDidDismiss();
    if (role !== 'ok') {
      return;
    }
    // rmv white space, break line, split by ;
    const walletAddressList = (data.values.walletAddress as string)
      .trim()
      .replace(/\s/g, '')
      .replace(/\n/g, '')
      .split(';');
    console.log('walletAddressList', walletAddressList);
    localStorage.setItem('walletsAddress', JSON.stringify(walletAddressList));
    return walletAddressList;
  }

  private async _loadData(walletsAddress: string[]) {
    // update wallet address list
    this.walletAddressList$.next(walletsAddress);
    // load wallets tokens
    const ionLoading = await new LoadingController().create({
      message: 'Loading...',
    });
    await ionLoading.present();
    await this._dataService.clear();
    await this._dataService.getWalletsTokens(walletsAddress);
    await this._dataService.getLoanPositions(walletsAddress);
    await this._dataService.getTokensMarketData();
    await ionLoading.dismiss();
  }
}
