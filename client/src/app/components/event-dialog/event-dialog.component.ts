import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-event-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, FormsModule
  ],
  template: `
    <h2 mat-dialog-title>{{ model._id ? '編輯競賽項目' : '新增競賽項目' }}</h2>
    <mat-dialog-content>
      <div class="flex flex-col gap-3 min-w-[340px] pt-3">
        <mat-form-field appearance="outline">
          <mat-label>項目名稱</mat-label>
          <input matInput [(ngModel)]="model.name" placeholder="例如：100 公尺、跳遠">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>項目類型</mat-label>
          <mat-select [(ngModel)]="model.type">
            <mat-option value="track">徑賽</mat-option>
            <mat-option value="field">田賽</mat-option>
            <mat-option value="relay">接力</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" *ngIf="model.type !== 'field'">
          <mat-label>跑道數</mat-label>
          <input matInput type="number" min="1" max="12" [(ngModel)]="model.laneCount">
        </mat-form-field>
        <mat-form-field appearance="outline" *ngIf="model.type !== 'field'">
          <mat-label>每組優先晉級人數</mat-label>
          <input matInput type="number" min="0" max="12" [(ngModel)]="model.advancePerHeat">
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">取消</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="!model.name">
        儲存
      </button>
    </mat-dialog-actions>
  `
})
export class EventDialogComponent {
  model: any;

  constructor(
    public dialogRef: MatDialogRef<EventDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.model = {
      ...(data.event || {}),
      competitionId: data.competitionId,
      groupId: data.groupId,
      name: data.event?.name || '',
      type: data.event?.type || 'track',
      laneCount: data.event?.laneCount || 8,
      advancePerHeat: data.event?.advancePerHeat ?? 2
    };
  }

  save() {
    this.model.laneCount = Math.min(12, Math.max(1, Number(this.model.laneCount || 8)));
    this.model.advancePerHeat = Math.max(0, Number(this.model.advancePerHeat || 0));
    this.dialogRef.close(this.model);
  }
}
