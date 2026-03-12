import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Trade } from '../../models/trading.models';

@Component({
  selector: 'app-trade-feed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="trade-feed">
      <div class="feed-header">Trade Feed</div>
      <div class="table-header">
        <span>Time</span>
        <span>Price</span>
        <span>Qty</span>
        <span>Buyer</span>
        <span>Seller</span>
      </div>
      <div class="rows">
        <div class="row" *ngFor="let trade of trades; let i = index" [class.flash]="i === 0 && flash">
          <span class="cell time">{{ formatTime(trade.timestamp) }}</span>
          <span class="cell price">{{ trade.price.toFixed(2) }}</span>
          <span class="cell qty">{{ trade.qty }}</span>
          <span class="cell buyer">{{ trade.buyer }}</span>
          <span class="cell seller">{{ trade.seller }}</span>
        </div>
        <div class="empty" *ngIf="trades.length === 0">No trades yet</div>
      </div>
    </div>
  `,
  styles: [`
    .trade-feed { background: #111827; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; }
    .feed-header {
      padding: 10px 14px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #00d4ff;
      border-bottom: 2px solid #00d4ff;
    }
    .table-header {
      display: grid;
      grid-template-columns: 1.2fr 1fr 0.7fr 1fr 1fr;
      padding: 6px 14px;
      color: #64748b;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      border-bottom: 1px solid #1e293b;
    }
    .rows { max-height: 300px; overflow-y: auto; }
    .row {
      display: grid;
      grid-template-columns: 1.2fr 1fr 0.7fr 1fr 1fr;
      padding: 6px 14px;
      border-bottom: 1px solid #0f172a;
    }
    .row.flash { animation: flashRow 0.5s ease-out; }
    @keyframes flashRow {
      0% { background: rgba(0, 212, 255, 0.2); }
      100% { background: transparent; }
    }
    .cell { font-size: 13px; }
    .time { color: #64748b; }
    .price { color: #ffd60a; font-weight: 600; }
    .qty { color: #94a3b8; }
    .buyer { color: #00ff9d; }
    .seller { color: #ff4560; }
    .empty { padding: 20px; text-align: center; color: #475569; font-size: 13px; }
  `]
})
export class TradeFeedComponent {
  @Input() trades: Trade[] = [];
  flash = false;

  ngOnChanges() {
    this.flash = true;
    setTimeout(() => this.flash = false, 600);
  }

  formatTime(ts: string): string {
    return new Date(ts).toLocaleTimeString();
  }
}
