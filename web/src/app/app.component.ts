import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebSocketService } from './services/websocket.service';
import { TradingApiService } from './services/trading-api.service';
import { HeaderComponent } from './components/header/header.component';
import { OrderBookComponent } from './components/order-book/order-book.component';
import { TradeFeedComponent } from './components/trade-feed/trade-feed.component';
import { OrderFormComponent } from './components/order-form/order-form.component';
import { ActivityLogComponent, LogEntry } from './components/activity-log/activity-log.component';
import { Trade, Order, PriceUpdate } from './models/trading.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    OrderBookComponent,
    TradeFeedComponent,
    OrderFormComponent,
    ActivityLogComponent,
  ],
  template: `
    <app-header
      [price]="currentPrice"
      [stocks]="stocks"
      [selectedStock]="selectedStock"
      (stockChange)="onStockChange($event)">
    </app-header>

    <div class="dashboard">
      <div class="main-row">
        <app-order-book [orders]="buys" side="BUY"></app-order-book>
        <app-order-book [orders]="sells" side="SELL"></app-order-book>
        <app-trade-feed [trades]="trades"></app-trade-feed>
      </div>
      <div class="bottom-row">
        <app-order-form [stocks]="stocks" (orderSubmitted)="onOrderSubmitted($event)"></app-order-form>
        <app-activity-log [entries]="logEntries"></app-activity-log>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .main-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1.5fr;
      gap: 16px;
    }
    .bottom-row {
      display: grid;
      grid-template-columns: 1fr 1.5fr;
      gap: 16px;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  stocks = ['XYZ'];
  selectedStock = 'XYZ';
  currentPrice: PriceUpdate = { stock: 'XYZ', lastPrice: 0, priceChange: 0 };
  buys: Order[] = [];
  sells: Order[] = [];
  trades: Trade[] = [];
  logEntries: LogEntry[] = [];

  // Per-stock caches
  private priceCache: Record<string, PriceUpdate> = {};
  private tradesCache: Record<string, Trade[]> = {};
  private booksCache: Record<string, { buys: Order[]; sells: Order[] }> = {};

  private subs: Subscription[] = [];

  constructor(
    private ws: WebSocketService,
    private api: TradingApiService,
  ) {}

  ngOnInit() {
    this.subs.push(
      this.ws.onSnapshot().subscribe((snapshot) => {
        for (const stock of Object.keys(snapshot)) {
          if (!this.stocks.includes(stock)) this.stocks.push(stock);
          this.tradesCache[stock] = snapshot[stock].trades;
          this.booksCache[stock] = {
            buys: snapshot[stock].orderbook.buys,
            sells: snapshot[stock].orderbook.sells,
          };
          this.priceCache[stock] = snapshot[stock].price;
        }
        this.refreshView();
        this.addLog('Connected to server — snapshot loaded');
      }),

      this.ws.onTrade().subscribe((trade) => {
        const stock = trade.stock || 'XYZ';
        if (!this.stocks.includes(stock)) this.stocks.push(stock);
        if (!this.tradesCache[stock]) this.tradesCache[stock] = [];
        this.tradesCache[stock].unshift(trade);
        if (this.tradesCache[stock].length > 50) this.tradesCache[stock].pop();
        this.refreshView();
        this.addLog(`Trade: ${trade.buyer} ↔ ${trade.seller} @ $${trade.price.toFixed(2)} [${stock}]`);
      }),

      this.ws.onOrderBook().subscribe((snapshot) => {
        const stock = snapshot.stock || 'XYZ';
        if (!this.stocks.includes(stock)) this.stocks.push(stock);
        this.booksCache[stock] = { buys: snapshot.buys, sells: snapshot.sells };
        this.refreshView();
      }),

      this.ws.onPrice().subscribe((price) => {
        const stock = price.stock || 'XYZ';
        this.priceCache[stock] = price;
        this.refreshView();
      }),
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  onStockChange(stock: string) {
    this.selectedStock = stock;
    this.refreshView();
  }

  onOrderSubmitted(order: { user: string; side: string; price: number; stock: string }) {
    this.api.submitOrder({ ...order, qty: 100 }).subscribe({
      next: () => {
        this.addLog(`Order sent: ${order.side} ${order.stock} @ $${order.price.toFixed(2)} by ${order.user}`);
      },
      error: (err) => {
        this.addLog(`Order failed: ${err.message || 'Server error'}`);
      },
    });
  }

  private refreshView() {
    const s = this.selectedStock;
    this.trades = this.tradesCache[s] || [];
    this.buys = this.booksCache[s]?.buys || [];
    this.sells = this.booksCache[s]?.sells || [];
    this.currentPrice = this.priceCache[s] || { stock: s, lastPrice: 0, priceChange: 0 };
  }

  private addLog(message: string) {
    this.logEntries.unshift({ time: new Date().toLocaleTimeString(), message });
    if (this.logEntries.length > 100) this.logEntries.pop();
  }
}
