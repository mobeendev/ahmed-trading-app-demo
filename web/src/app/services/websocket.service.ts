import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject, Observable } from 'rxjs';
import { Trade, OrderBook, PriceUpdate, Snapshot } from '../models/trading.models';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket: Socket;
  private snapshot$ = new Subject<Snapshot>();
  private trade$ = new Subject<Trade>();
  private orderbook$ = new Subject<OrderBook>();
  private price$ = new Subject<PriceUpdate>();

  constructor() {
    this.socket = io('http://localhost:3000');

    this.socket.on('snapshot', (data: Snapshot) => this.snapshot$.next(data));
    this.socket.on('trade', (data: Trade) => this.trade$.next(data));
    this.socket.on('orderbook', (data: OrderBook) => this.orderbook$.next(data));
    this.socket.on('price', (data: PriceUpdate) => this.price$.next(data));
  }

  onSnapshot(): Observable<Snapshot> { return this.snapshot$.asObservable(); }
  onTrade(): Observable<Trade> { return this.trade$.asObservable(); }
  onOrderBook(): Observable<OrderBook> { return this.orderbook$.asObservable(); }
  onPrice(): Observable<PriceUpdate> { return this.price$.asObservable(); }

  ngOnDestroy(): void {
    this.socket.disconnect();
  }
}
