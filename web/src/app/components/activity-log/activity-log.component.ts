import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LogEntry {
  time: string;
  message: string;
}

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="activity-log">
      <div class="log-header">Activity Log</div>
      <div class="entries">
        <div class="entry" *ngFor="let entry of entries">
          <span class="time">{{ entry.time }}</span>
          <span class="msg">{{ entry.message }}</span>
        </div>
        <div class="empty" *ngIf="entries.length === 0">No activity yet</div>
      </div>
    </div>
  `,
  styles: [`
    .activity-log { background: #111827; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; }
    .log-header {
      padding: 10px 14px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #94a3b8;
      border-bottom: 2px solid #334155;
    }
    .entries { max-height: 200px; overflow-y: auto; }
    .entry {
      padding: 6px 14px;
      border-bottom: 1px solid #0f172a;
      font-size: 12px;
      display: flex;
      gap: 10px;
    }
    .time { color: #475569; white-space: nowrap; }
    .msg { color: #94a3b8; }
    .empty { padding: 20px; text-align: center; color: #475569; font-size: 13px; }
  `]
})
export class ActivityLogComponent {
  @Input() entries: LogEntry[] = [];
}
