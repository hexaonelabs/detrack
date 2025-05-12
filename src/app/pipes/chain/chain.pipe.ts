import { Pipe, PipeTransform } from '@angular/core';
import { AVAILABLE_CHAINS } from '../../app.constantes';

@Pipe({
  name: 'chain',
  standalone: true
})
export class ChainPipe implements PipeTransform {

  transform(chainId: string, key: any) {
    const chain = AVAILABLE_CHAINS.find(
      (chain) => chain.id === Number(chainId)
    )!;
    return (chain as any)[key];
  }

}
