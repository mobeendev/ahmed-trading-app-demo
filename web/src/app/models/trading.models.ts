export interface Order {
  id: string;
  user: string;
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  stock: string;
  timestamp: string;
}

export interface Trade {
  buyer: string;
  seller: string;
  price: number;
  qty: number;
  stock: string;
  timestamp: string;
}

export interface OrderBook {
  stock: string;
  buys: Order[];
  sells: Order[];
}

export interface PriceUpdate {
  stock: string;
  lastPrice: number;
  priceChange: number;
}

export interface StockSnapshot {
  trades: Trade[];
  orderbook: OrderBook;
  price: PriceUpdate;
}

export interface Snapshot {
  [stock: string]: StockSnapshot;
}
