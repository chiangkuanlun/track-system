import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CompetitionService } from '../../services/competition.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-event-result-dialog',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatIconModule, 
    MatTableModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="relative bg-white rounded-lg">
      <div class="flex justify-between items-start mb-4 pr-8 border-b pb-3">
        <div>
          <h2 mat-dialog-title class="m-0 text-xl font-bold text-gray-800">{{ data.eventName }}</h2>
          <p class="text-sm text-gray-500 mt-1 font-bold">
            {{ data.groupName }} 
            <span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs ml-2">
              {{ viewRound }} 成績表
            </span>
          </p>
        </div>
        <button mat-icon-button (click)="close()" class="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content class="max-h-[70vh] custom-scrollbar p-0">
        
        <div *ngIf="isLoading" class="flex justify-center py-10">
          <mat-spinner diameter="40"></mat-spinner>
        </div>

        <div *ngIf="!isLoading && displayHeats.length > 0">
          
          <div *ngFor="let heat of displayHeats" class="mb-6">
            
            <h3 *ngIf="!isFinalView" class="font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded text-sm mb-2 border-l-4 border-gray-400">
              {{ heat.name }}
            </h3>
            
            <table class="w-full text-left text-sm border-collapse">
              <thead class="bg-gray-50 text-gray-500 border-b border-gray-200">
                <tr>
                  <th class="py-2 px-3 w-14 text-center">排名</th>
                  <th *ngIf="!isFinalView" class="py-2 px-2 w-14 text-center">道次</th>
                  <th class="py-2 px-3">姓名 / 單位</th>
                  <th class="py-2 px-3 text-right">成績</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let lane of heat.lanes" class="border-b border-gray-100 last:border-0 hover:bg-yellow-50 transition">
                  <td class="py-3 px-3 text-center font-black text-lg" 
                      [ngClass]="{
                        'text-yellow-500': lane.rank === 1,
                        'text-gray-400': lane.rank > 3 || lane.rank === 0,
                        'text-gray-600': lane.rank === 2 || lane.rank === 3
                      }">
                    <span *ngIf="lane.rank > 0">{{ lane.rank }}</span>
                    <span *ngIf="lane.rank === 0 && lane.result">-</span>
                  </td>
                  
                  <td *ngIf="!isFinalView" class="py-3 px-2 text-center text-gray-400 font-mono">
                    {{ lane.laneNumber }}
                  </td>
                  
                  <td class="py-3 px-3">
                    <div class="font-bold text-gray-800 text-base">{{ lane.athleteName }}</div>
                    <div class="text-xs text-gray-500 mt-0.5 bg-gray-100 inline-block px-1.5 rounded">
                      {{ lane.teamName }}
                    </div>
                  </td>
                  
                  <td class="py-3 px-3 text-right font-mono font-bold text-blue-600 text-lg">
                    {{ lane.result || '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        <div *ngIf="!isLoading && displayHeats.length === 0" class="text-center py-10 text-gray-400 bg-gray-50 rounded-lg mx-4">
          <mat-icon class="mb-2">hourglass_empty</mat-icon>
          <p>尚無成績資料</p>
        </div>

      </mat-dialog-content>

      <mat-dialog-actions align="end" class="pt-2 border-t mt-2">
        <button mat-stroked-button color="primary" (click)="close()">關閉</button>
      </mat-dialog-actions>
    </div>
  `
})
export class EventResultDialogComponent implements OnInit {
  isLoading = true;
  eventDetails: any = null;
  displayHeats: any[] = [];
  viewRound = ''; // 當前顯示的輪次名稱
  isFinalView = false; // 是否正在顯示決賽

  constructor(
    public dialogRef: MatDialogRef<EventResultDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      eventId: string, 
      eventName: string, 
      groupName: string,
      targetRound?: string // ★ 新增：指定要看哪一輪
    },
    private competitionService: CompetitionService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;

    forkJoin({
      event: this.competitionService.getEventById(this.data.eventId),
      athletes: this.competitionService.getAthletesByEventId(this.data.eventId)
    }).subscribe({
      next: ({ event, athletes }) => {
        this.eventDetails = event;
        
        // 1. 決定要顯示哪一輪
        // 如果有傳入 targetRound，就用傳入的；否則顯示當前輪次
        const currentActiveRound = event.currentRound || (event.rounds && event.rounds.length > 0 ? event.rounds[event.rounds.length-1] : '決賽');
        this.viewRound = this.data.targetRound || currentActiveRound;
        this.isFinalView = this.viewRound.includes('決賽');

        // 2. 決定資料來源 (是目前的 heats 還是 歷史的 roundResults)
        let sourceHeats = [];

        if (this.viewRound === currentActiveRound) {
          // 看目前輪次
          sourceHeats = event.heats || [];
        } else {
          // 看歷史輪次
          const history = event.roundResults?.find((r: any) => r.roundName === this.viewRound);
          sourceHeats = history ? history.heats : [];
        }

        // 3. 建立選手對照表
        const athleteMap = new Map<string, any>();
        if (athletes && Array.isArray(athletes)) {
          athletes.forEach((a: any) => athleteMap.set(a._id, a));
        }

        // 4. 處理顯示資料
        if (sourceHeats) {
          this.displayHeats = sourceHeats.map((heat: any) => ({
            name: heat.name,
            lanes: heat.lanes
              .filter((l: any) => l.athleteId) 
              .map((l: any) => {
                
                let idStr = '';
                if (typeof l.athleteId === 'object' && l.athleteId !== null) {
                  idStr = l.athleteId._id || '';
                } else {
                  idStr = String(l.athleteId);
                }

                const foundAthlete = athleteMap.get(idStr);
                let athName = '未知選手';
                let teamName = '個人';

                if (foundAthlete) {
                  athName = foundAthlete.name;
                  teamName = foundAthlete.team || '個人';
                } else if (typeof l.athleteId === 'object' && l.athleteId.name) {
                  athName = l.athleteId.name;
                  teamName = l.athleteId.team || '個人';
                }

                return {
                  laneNumber: l.laneNumber,
                  rank: l.rank,
                  result: l.result,
                  athleteName: athName,
                  teamName: teamName,
                  status: l.status
                };
              })
              .sort((a: any, b: any) => {
                if (a.rank > 0 && b.rank > 0) return a.rank - b.rank;
                if (a.rank > 0) return -1;
                if (b.rank > 0) return 1;
                return a.laneNumber - b.laneNumber;
              })
          }));
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('載入失敗', err);
        this.isLoading = false;
      }
    });
  }

  close() {
    this.dialogRef.close();
  }
}