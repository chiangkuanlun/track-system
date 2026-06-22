import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { CompetitionService } from '../../services/competition.service';

@Component({
  selector: 'app-lane-assignment-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule,
    MatIconModule, MatTooltipModule, DragDropModule
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
      eventId: string;
      eventName: string;
      eventType: string;
      existingHeats: any[];
    },
    private competitionService: CompetitionService
  ) {}

  ngOnInit() {
    if (this.data.existingHeats?.length) {
      this.heats = this.data.existingHeats;
    } else {
      this.autoInitialize();
    }
  }

  autoInitialize() {
    this.isLoading = true;
    this.competitionService.initializeHeats(this.data.eventId).subscribe({
      next: result => {
        this.heats = result;
        this.isLoading = false;
      },
      error: err => {
        alert(err.error?.message || '自動分組失敗');
        this.isLoading = false;
      }
    });
  }

  drop(event: CdkDragDrop<any[]>) {
    const sourceLane = event.previousContainer.data[event.previousIndex];
    const targetLane = event.container.data[event.currentIndex];
    if (!sourceLane?.athleteId || !targetLane || sourceLane === targetLane) return;

    const sourceAthleteId = sourceLane.athleteId;
    const sourceAthlete = sourceLane.athlete;
    sourceLane.athleteId = targetLane.athleteId || null;
    sourceLane.athlete = targetLane.athlete || null;
    targetLane.athleteId = sourceAthleteId;
    targetLane.athlete = sourceAthlete;
  }

  save() {
    this.isLoading = true;
    this.competitionService.saveHeats(this.data.eventId, this.heats).subscribe({
      next: () => this.dialogRef.close(true),
      error: err => {
        alert(err.error?.message || '儲存分組失敗');
        this.isLoading = false;
      }
    });
  }

  close() {
    this.dialogRef.close();
  }
}
