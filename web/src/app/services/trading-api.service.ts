import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Trade, OrderBook } from '../models/trading.models';

@Injectable({ providedIn: 'root' })
export class TradingApiService {
  private base = '/api';

  constructor(private http: HttpClient) {}

  submitOrder(order: { user: string; side: string; price: number; qty: number; stock: string }): Observable<any> {
    return this.http.post(`${this.base}/orders`, order);
  }

  getTrades(stock: string): Observable<Trade[]> {
    return this.http.get<Trade[]>(`${this.base}/trades`, { params: { stock } });
  }

  getOrderBook(stock: string): Observable<OrderBook> {
    return this.http.get<OrderBook>(`${this.base}/orderbook`, { params: { stock } });
  }
}
