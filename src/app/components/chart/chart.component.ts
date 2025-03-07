import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input } from '@angular/core';
import { ColorType, IChartApi, LineSeries, createChart } from 'lightweight-charts';

@Component({
  standalone: true,
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss'],
  imports: [CommonModule],
})
export class ChartComponent {
  public price = 0;
  public time = new Date().toLocaleString();
  @Input() totalWorth = 0;
  @Input() set data(data: number[]) {
    if (this.chartElement) {
      this.chartElement.remove();
    }
    if (!this._elementRef.nativeElement) {
      return;
    }
    const el = this._elementRef.nativeElement.querySelector('div');
    if (!el) {
      return;
    }

    this.chartElement = createChart(el, {
      width: 800,
      height: 400,
      layout: {
        background: {
          type: ColorType.Solid,
          color: 'transparent',
        },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: {
          visible: false,
        },
        horzLines: {
          // color: 'rgba(42, 46, 57, 0.05)',
          visible: false,
        },
      },
      rightPriceScale: {
        borderVisible: false,
        visible: false,
      },
      timeScale: {
        borderVisible: false,
        visible: false,
      },
      crosshair: {
        horzLine: {
          // visible: false,
          style: 4,
        },
      },
      autoSize: true,
      handleScroll: false,
      handleScale: false,
    });
    function formatDataForChart(
      data: number[]
    ): { time: number; value: number }[] {
      const interval = 1000 * 60 * 30; // Intervalle de 30 minutes en millisecondes
      const startTime = Date.now() - interval * (data.length - 1);

      return data.map((value, index) => {
        const time = new Date(startTime + interval * index).getTime();
        return { time, value };
      });
    }
    const formattedData = formatDataForChart(data);
    const lineSeries = this.chartElement.addSeries(LineSeries);
    lineSeries.setData(
      // loop through the data array and return an object with the time property
      // base on past 7 days starting from now with 30 minutes interval
      formattedData as any
    );
    //  manage legend
    const updateLegend = (param: any) => {
      this.time = param.time
        ? new Date(param.time).toLocaleString()
        : new Date().toLocaleString();
      this.price =
        param.time &&
        (param.seriesData as Map<any, any>).get(lineSeries)?.value !== undefined
          ? (param.seriesData as Map<any, any>).get(lineSeries)?.value
          : this.totalWorth || data?.[data.length - 1] || 0;
    };
    this.chartElement.subscribeCrosshairMove(updateLegend);
    // use setTimeout to handle input value from other component input
    setTimeout(() => {
      this.price = this.totalWorth || data[data.length - 1] || 0;
    });
  }
  public chartElement!: IChartApi;

  constructor(private readonly _elementRef: ElementRef<HTMLElement>) {}
}
