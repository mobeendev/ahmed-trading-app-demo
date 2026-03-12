import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PriceUpdate } from '../../models/trading.models';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="header">
      <div class="stock-selector">
        <label>STOCK</label>
        <select [ngModel]="selectedStock" (ngModelChange)="onStockChange($event)">
          <option *ngFor="let s of stocks" [value]="s">{{ s }}</option>
        </select>
      </div>
      <div class="price-display">
        <span class="stock-label">{{ selectedStock }} Corp</span>
        <span class="price" [class.up]="price.priceChange > 0" [class.down]="price.priceChange < 0">
          {{ price.lastPrice > 0 ? ('$' + price.lastPrice.toFixed(2)) : '—' }}
        </span>
        <span class="change" *ngIf="price.lastPrice > 0"
              [class.up]="price.priceChange > 0"
              [class.down]="price.priceChange < 0">
          {{ price.priceChange >= 0 ? '+' : '' }}{{ price.priceChange.toFixed(2) }}
          ({{ changePercent }}%)
        </span>
      </div>
      <div class="clock">{{ time }}</div>
    </div>
  `,
  styles: [`
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: #111827;
      border-bottom: 1px solid #1e293b;
    }
    .stock-selector {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stock-selector label {
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
    }
    select {
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      padding: 6px 12px;
      border-radius: 4px;
      font-family: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    .price-display {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    .stock-label {
      color: #94a3b8;
      font-size: 14px;
      font-weight: 600;
    }
    .price {
      font-size: 28px;
      font-weight: 700;
      color: #e2e8f0;
    }
    .change {
      font-size: 14px;
      font-weight: 600;
    }
    .up { color: #00ff9d; }
    .down { color: #ff4560; }
    .clock {
      color: #64748b;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }
  `]
})
export class HeaderComponent {
  @Input() price: PriceUpdate = { stock: 'XYZ', lastPrice: 0, priceChange: 0 };
  @Input() stocks: string[] = ['XYZ'];
  @Input() selectedStock = 'XYZ';
  @Output() stockChange = new EventEmitter<string>();

  time = '';
  private timer: any;

  ngOnInit() {
    this.updateTime();
    this.timer = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  get changePercent(): string {
    if (this.price.lastPrice === 0) return '0.00';
    const prev = this.price.lastPrice - this.price.priceChange;
    if (prev === 0) return '0.00';
    return ((this.price.priceChange / prev) * 100).toFixed(2);
  }

  onStockChange(stock: string) {
    this.stockChange.emit(stock);
  }

  private updateTime() {
    this.time = new Date().toLocaleTimeString();
  }
}
