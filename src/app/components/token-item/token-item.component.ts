import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { IonAccordion, IonAccordionGroup, IonAvatar, IonCard, IonCol, IonGrid, IonItem, IonLabel, IonNote, IonRow } from '@ionic/angular/standalone';
import { GroupedTokenWithBalance, GroupedTokenWithBalanceAndMarketData, TokenWithBalance } from '../../interfaces/token';
import { TotalPercentPipe } from '../../pipes/total-percent/total-percent.pipe';

const UIElements = [
  IonItem,
  IonAvatar,
  IonNote,
  IonLabel,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonAccordion,
  IonAccordionGroup,
];

@Component({
  standalone: true,
  selector: 'app-token-item',
  templateUrl: './token-item.component.html',
  styleUrls: ['./token-item.component.scss'],
  imports: [...UIElements, CommonModule, TotalPercentPipe],
})
export class TokenItemComponent {
  @Input() token!: GroupedTokenWithBalanceAndMarketData | TokenWithBalance;
  @Input() totalWalletWorth?: number;
}
