import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CompetitionService } from '../../services/competition.service';

@Component({
  selector: 'app-arrange-next-round-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>下一輪晉級預覽</h2>
    <mat-dialog-content>
      <div class="mb-4 text-gray-600">
        <p>目前輪次：<span class="font-bold text-blue-600">{{ data.currentRound }}</span></p>
        <p>下一輪次：<span class="font-bold text-green-600">{{ nextRoundName }}</span></p>
        <p>預計晉級人數：<span class="font-bold">{{ qualifyCount }} 人</span></p>
      </div>

      <div class="border rounded-lg overflow-hidden">
        <table class="w-full text-sm text-left">
          <thead class="bg-gray-100 text-gray-700 font-bold">
            <tr>
              <th class="p-2">排名</th>
              <th class="p-2">姓名</th>
              <th class="p-2">成績</th>
              <th class="p-2">狀態</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let q of qualifiers; let i = index" 
                [class.bg-green-50]="i < qualifyCount"
                [class.border-l-4]="i < qualifyCount"
                [class.border-l-green-500]="i < qualifyCount">
              <td class="p-2">{{ i + 1 }}</td>
              <td class="p-2 font-bold">{{ q.name }}</td>
              <td class="p-2">{{ q.result }}</td>
              <td class="p-2">
                <span *ngIf="i < qualifyCount" class="text-green-600 font-bold text-xs">晉級</span>
                <span *ngIf="i >= qualifyCount" class="text-gray-400 text-xs">淘汰</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <p class="mt-4 text-xs text-red-500 bg-red-50 p-2 rounded">
        <mat-icon class="align-middle text-sm">warning</mat-icon>
        注意：按下確認後，目前的成績將被封存，系統將產生新的分組表。
      </p>

    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>取消</button>
      <button mat-flat-button color="accent" (click)="confirm()" [disabled]="isLoading">
        {{ isLoading ? '處理中...' : '確認並產生賽程' }}
      </button>
    </mat-dialog-actions>
  `
})
export class ArrangeNextRoundDialogComponent implements OnInit {
  qualifiers: any[] = [];
  nextRoundName = '';
  qualifyCount = 8;
  isLoading = false;

  constructor(
    public dialogRef: MatDialogRef<ArrangeNextRoundDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private competitionService: CompetitionService
  ) {}

  ngOnInit() {
    this.determineNextRound();
    this.calculatePreview();
  }

  determineNextRound() {
    const rounds = this.data.event.rounds || [];
    const currentIdx = rounds.indexOf(this.data.currentRound);
    if (currentIdx !== -1 && currentIdx < rounds.length - 1) {
      this.nextRoundName = rounds[currentIdx + 1];
      
      // 設定晉級人數規則
      if (this.nextRoundName === '準決賽') this.qualifyCount = 16;
      else if (this.nextRoundName === '決賽') this.qualifyCount = 8;
    }
  }

  calculatePreview() {
    // 前端簡易計算預覽
    const allAthletes: any[] = [];
    this.data.event.heats.forEach((heat: any) => {
      heat.lanes.forEach((lane: any) => {
        if (lane.athleteId && lane.result && lane.status === 'Normal') {
          // 這裡需要用 ID 對照名字 (data.athletes 是傳進來的選手列表)
          const athInfo = this.data.athletes.find((a: any) => a._id === lane.athleteId);
          allAthletes.push({
            name: athInfo ? athInfo.name : '未知選手',
            result: lane.result,
            val: parseFloat(lane.result)
          });
        }
      });
    });

    const isField = this.data.event.type === 'field';
    allAthletes.sort((a, b) => isField ? b.val - a.val : a.val - b.val);
    this.qualifiers = allAthletes;
  }

  confirm() {
    this.isLoading = true;
    this.competitionService.arrangeNextRound(this.data.event._id).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: (err) => {
        alert('編排失敗');
        this.isLoading = false;
      }
    });
  }
}
