import { Component, Input, OnInit } from '@angular/core';
import { AlertController, IonAccordion, IonAccordionGroup, IonCard, IonCol, IonGrid, IonItem, IonList, IonListHeader, IonRow } from '@ionic/angular/standalone';
import { map } from 'rxjs';
import { CommonModule } from '@angular/common';
import { TokenItemComponent } from '../token-item/token-item.component';
import { GroupedTokenWithBalance, GroupedTokenWithBalanceAndMarketData } from '../../interfaces/token';

const UIElements = [
  IonGrid,
  IonCol,
  IonRow,
  IonList,
  IonCard,
  IonAccordion,
  IonAccordionGroup,
];

@Component({
  standalone: true,
  selector: 'app-tokens-list',
  templateUrl: './tokens-list.component.html',
  styleUrls: ['./tokens-list.component.scss'],
  imports: [CommonModule, ...UIElements, TokenItemComponent],
})
export class TokensListComponent {
  @Input() tokens!: GroupedTokenWithBalanceAndMarketData[];
  @Input() totalWalletWorth!: number;

  trackByFn(index: number, item: { address?: string; symbol?: string;}): string {
    return item.address || item.symbol || index.toString();
  }
}
