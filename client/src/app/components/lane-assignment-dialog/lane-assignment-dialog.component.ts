import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CompetitionService } from '../../services/competition.service';

@Component({
  selector: 'app-lane-assignment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    DragDropModule
  ],
  templateUrl: './lane-assignment-dialog.component.html',
  styleUrls: ['./lane-assignment-dialog.component.scss']
})
export class LaneAssignmentDialogComponent implements OnInit {
  heats: any[] = [];
  isLoading = false;

  constructor(
    public dialogRef: MatDialogRef<LaneAssignmentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      eventId: string, eventName: string, eventType: string, existingHeats: any[]
    },
    private competitionService: CompetitionService
  ) {}

  ngOnInit() {
    if (this.data.existingHeats && this.data.existingHeats.length > 0) {
      // 如果已經有資料，直接顯示 (需處理資料結構以符合前端顯示)
      this.heats = this.processHeatsForDisplay(this.data.existingHeats);
    } else {
      // 否則自動執行初始化
      this.autoInitialize();
    }
  }

  processHeatsForDisplay(heats: any[]) {
    // 確保 lanes 裡的 athlete 是物件而不是純 ID (如果後端有 populate)
    // 如果後端只回傳 ID，這裡可能需要額外處理，但 initializeHeats API 會回傳完整物件
    return heats;
  }

  autoInitialize() {
    this.isLoading = true;
    this.competitionService.initializeHeats(this.data.eventId).subscribe({
      next: (result) => {
        this.heats = result;
        this.isLoading = false;
      },
      error: (err) => {
        alert('分組失敗');
        this.isLoading = false;
      }
    });
  }

  // 拖放邏輯
  drop(event: CdkDragDrop<any[]>) {
    const prevLane = event.previousContainer.data[event.previousIndex];
    const currLane = event.container.data[event.currentIndex];

    // 交換選手資料
    // 注意：Dialog 裡的資料結構可能包含 athlete 物件，不只是 ID，所以要一起換

    // 1. 交換 ID
    const tempId = prevLane.athleteId;
    prevLane.athleteId = currLane.athleteId;
    currLane.athleteId = tempId;

    // 2. 交換選手物件 (為了讓畫面即時更新顯示)
    const tempAthlete = prevLane.athlete;
    prevLane.athlete = currLane.athlete;
    currLane.athlete = tempAthlete;
  }

  // 強制重設道次號碼 1-8 (因為陣列順序改變了)
  reorderLanes(lanes: any[]) {
    lanes.forEach((lane, index) => {
      lane.laneNumber = index + 1;
    });
  }

  save() {
    this.isLoading = true;
    this.competitionService.saveHeats(this.data.eventId, this.heats).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: () => {
        alert('儲存失敗');
        this.isLoading = false;
      }
    });
  }

  close() {
    this.dialogRef.close();
  }
}
