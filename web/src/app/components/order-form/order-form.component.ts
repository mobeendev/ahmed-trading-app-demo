import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="order-form">
      <div class="form-header">Submit Order</div>
      <div class="form-body">
        <div class="field">
          <label>Username</label>
          <input [(ngModel)]="user" placeholder="e.g. alice" />
        </div>
        <div class="field">
          <label>Stock</label>
          <select [(ngModel)]="stock">
            <option *ngFor="let s of stocks" [value]="s">{{ s }}</option>
          </select>
        </div>
        <div class="field">
          <label>Side</label>
          <div class="toggle">
            <button [class.active]="side === 'BUY'" [class.buy]="side === 'BUY'" (click)="side = 'BUY'">BUY</button>
            <button [class.active]="side === 'SELL'" [class.sell]="side === 'SELL'" (click)="side = 'SELL'">SELL</button>
          </div>
        </div>
        <div class="field">
          <label>Price ($)</label>
          <input type="number" [(ngModel)]="price" step="0.01" min="0.01" placeholder="142.50" />
        </div>
        <button class="submit-btn" [class.buy]="side === 'BUY'" [class.sell]="side === 'SELL'"
                (click)="submit()" [disabled]="!isValid">
          {{ side }} {{ stock }}
        </button>
        <div class="status" *ngIf="statusMsg" [class.error]="statusError">{{ statusMsg }}</div>
      </div>
    </div>
  `,
  styles: [`
    .order-form { background: #111827; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; }
    .form-header {
      padding: 10px 14px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #ffd60a;
      border-bottom: 2px solid #ffd60a;
    }
    .form-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    label { color: #64748b; font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
    input, select {
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: inherit;
      font-size: 14px;
    }
    input:focus, select:focus { outline: none; border-color: #00d4ff; }
    .toggle { display: flex; gap: 0; }
    .toggle button {
      flex: 1;
      padding: 8px;
      background: #1e293b;
      color: #64748b;
      border: 1px solid #334155;
      cursor: pointer;
      font-family: inherit;
      font-weight: 700;
      font-size: 13px;
    }
    .toggle button:first-child { border-radius: 4px 0 0 4px; }
    .toggle button:last-child { border-radius: 0 4px 4px 0; }
    .toggle button.active.buy { background: #00ff9d; color: #0a0e1a; border-color: #00ff9d; }
    .toggle button.active.sell { background: #ff4560; color: #fff; border-color: #ff4560; }
    .submit-btn {
      padding: 10px;
      border: none;
      border-radius: 4px;
      font-family: inherit;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      letter-spacing: 1px;
    }
    .submit-btn.buy { background: #00ff9d; color: #0a0e1a; }
    .submit-btn.sell { background: #ff4560; color: #fff; }
    .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .status { font-size: 12px; color: #00ff9d; padding: 4px 0; }
    .status.error { color: #ff4560; }
  `]
})
export class OrderFormComponent {
  @Input() stocks: string[] = ['XYZ'];
  @Output() orderSubmitted = new EventEmitter<{ user: string; side: string; price: number; stock: string }>();

  user = '';
  side: 'BUY' | 'SELL' = 'BUY';
  price: number | null = null;
  stock = 'XYZ';
  statusMsg = '';
  statusError = false;

  get isValid(): boolean {
    return !!this.user && this.price !== null && this.price > 0;
  }

  submit() {
    if (!this.isValid) return;
    this.orderSubmitted.emit({
      user: this.user,
      side: this.side,
      price: this.price!,
      stock: this.stock,
    });
    this.statusMsg = `${this.side} order submitted for ${this.stock} @ $${this.price!.toFixed(2)}`;
    this.statusError = false;
  }
}
