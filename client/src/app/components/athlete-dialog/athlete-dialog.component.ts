import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';

export interface AthleteDialogData {
  bibNumber: string;
  name: string;
  team: string;
  isRelay: boolean; // 用來判斷是否鎖定某些欄位或改變標題
}

@Component({
  selector: 'app-athlete-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule
  ],
  template: `
    <h2 mat-dialog-title>編輯選手資料</h2>
    <mat-dialog-content>
      <div class="flex flex-col gap-4 min-w-[300px] pt-4">
        <mat-form-field appearance="outline" *ngIf="!data.isRelay">
          <mat-label>號碼布</mat-label>
          <input matInput [(ngModel)]="data.bibNumber">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>姓名</mat-label>
          <input matInput [(ngModel)]="data.name" required>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>單位 / 隊名</mat-label>
          <input matInput [(ngModel)]="data.team" required>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>取消</button>
      <button mat-flat-button color="primary" [mat-dialog-close]="data">儲存</button>
    </mat-dialog-actions>
  `
})
export class AthleteDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<AthleteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AthleteDialogData
  ) {}
}
