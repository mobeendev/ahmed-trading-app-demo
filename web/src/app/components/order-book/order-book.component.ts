import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order } from '../../models/trading.models';

@Component({
  selector: 'app-order-book',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="order-book">
      <div class="book-header" [class.buy]="side === 'BUY'" [class.sell]="side === 'SELL'">
        {{ side }} Orders
      </div>
      <div class="table-header">
        <span>User</span>
        <span>Price</span>
        <span>Qty</span>
      </div>
      <div class="rows">
        <div class="row" *ngFor="let order of sortedOrders; trackBy: trackById">
          <div class="bar" [class.buy-bar]="side === 'BUY'" [class.sell-bar]="side === 'SELL'"
               [style.width.%]="getBarWidth(order)"></div>
          <span class="cell user">{{ order.user }}</span>
          <span class="cell price">{{ order.price.toFixed(2) }}</span>
          <span class="cell qty">{{ order.qty }}</span>
        </div>
        <div class="empty" *ngIf="orders.length === 0">No {{ side }} orders</div>
      </div>
    </div>
  `,
  styles: [`
    .order-book { background: #111827; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; }
    .book-header {
      padding: 10px 14px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .book-header.buy { color: #00ff9d; border-bottom: 2px solid #00ff9d; }
    .book-header.sell { color: #ff4560; border-bottom: 2px solid #ff4560; }
    .table-header {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
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
      grid-template-columns: 1fr 1fr 1fr;
      padding: 6px 14px;
      position: relative;
      border-bottom: 1px solid #0f172a;
    }
    .bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      opacity: 0.1;
    }
    .buy-bar { background: #00ff9d; }
    .sell-bar { background: #ff4560; }
    .cell { position: relative; z-index: 1; font-size: 13px; }
    .user { color: #94a3b8; }
    .price { color: #e2e8f0; font-weight: 600; }
    .qty { color: #94a3b8; text-align: right; }
    .empty { padding: 20px; text-align: center; color: #475569; font-size: 13px; }
  `]
})
export class OrderBookComponent {
  @Input() orders: Order[] = [];
  @Input() side: 'BUY' | 'SELL' = 'BUY';

  get sortedOrders(): Order[] {
    const sorted = [...this.orders];
    if (this.side === 'BUY') {
      sorted.sort((a, b) => b.price - a.price);
    } else {
      sorted.sort((a, b) => a.price - b.price);
    }
    return sorted;
  }

  getBarWidth(order: Order): number {
    if (this.orders.length === 0) return 0;
    const maxQty = Math.max(...this.orders.map(o => o.qty));
    return maxQty > 0 ? (order.qty / maxQty) * 100 : 0;
  }

  trackById(_: number, order: Order) {
    return order.id;
  }
}
