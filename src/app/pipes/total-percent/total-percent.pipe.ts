import { Pipe, PipeTransform } from '@angular/core';
import { TokenWithBalance } from '../../interfaces/token';

@Pipe({
  name: 'totalPercent',
  standalone: true
})
export class TotalPercentPipe implements PipeTransform {

  transform(value: Pick<TokenWithBalance, 'priceUSD' | 'balance'>, totalWalletWorth: number): number {
    // calcul wallet ratio
    const assetTotal =  Number(value.priceUSD) * Number(value.balance);
    const ratio = assetTotal / totalWalletWorth;
    // return ratio as percentage
    return ratio * 100;
  }
  
}
