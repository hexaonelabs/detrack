import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CommonModule } from '@angular/common';
import {
  AlertController,
  IonApp,
  IonBadge,
  IonButton,
  IonCard,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonRow,
  IonText,
  LoadingController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addCircle, walletOutline } from 'ionicons/icons';
import { TokensListComponent } from './components/tokens-list/tokens-list.component';
import { TokenService } from './services/token/token.service';
import { ChartComponent } from './components/chart/chart.component';
import { BehaviorSubject } from 'rxjs';

const UIElements = [
  IonApp,
  IonContent,
  IonGrid,
  IonCol,
  IonRow,
  IonCard,
  IonButton,
  IonIcon,
  IonText,
  IonBadge,
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    ...UIElements,
    TokensListComponent,
    ChartComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'detrack';
  public readonly tokens$;
  public readonly totalWorth$;
  public readonly history$;
  public readonly walletAddressList$ = new BehaviorSubject<string[]>([]);

  constructor(private readonly _dataService: TokenService) {
    addIcons({
      addCircle,
      walletOutline,
    });
    this.tokens$ = this._dataService.tokens$;
    this.totalWorth$ = this._dataService.balanceUSD$;
    this.history$ = this._dataService.getPortfolioHistory$(30);
  }

  async ngOnInit() {
    const storedWalletAddressListJSON = localStorage.getItem('walletsAddress');
    const storedWalletsAddress: string[] = storedWalletAddressListJSON
      ? JSON.parse(storedWalletAddressListJSON)
      : [];
    const walletsAddress =
      storedWalletsAddress.length > 0
        ? storedWalletsAddress
        : await this._promptAccountList();
    if (!walletsAddress) {
      const ionAlert = await new AlertController().create({
        header: 'Error',
        message: 'Please enter at least one wallet address',
        buttons: ['OK'],
      });
      await ionAlert.present();
      await ionAlert.onDidDismiss();
      this.ngOnInit();
      return;
    }
    await this._loadData(walletsAddress);
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
      message:
        'Please enter EVM or Cosmos Wallet Address, separated by semicolon (;)',
      inputs: [
        {
          name: 'walletAddress',
          type: 'textarea',
          placeholder: '0x..., cosmos...',
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
    await this._dataService.getTokensMarketData();
    await ionLoading.dismiss();
  }
}
