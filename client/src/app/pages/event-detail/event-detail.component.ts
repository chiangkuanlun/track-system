import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

// Material & UI
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

import { CompetitionService } from '../../services/competition.service';
import { AuthService } from '../../services/auth.service';
import { CompetitionFormPrinterService } from '../../services/competition-form-printer.service';
import { AthleteDialogComponent } from '../../components/athlete-dialog/athlete-dialog.component';
import { HeaderComponent } from '../../components/header/header.component';
import { LaneAssignmentDialogComponent} from '../../components/lane-assignment-dialog/lane-assignment-dialog.component';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatDialogModule,
    MatTooltipModule,
    MatDividerModule,
    DragDropModule
  ],
  templateUrl: './event-detail.component.html',
  styleUrls: ['./event-detail.component.scss'],
  providers: [CompetitionFormPrinterService]
})
export class EventDetailComponent implements OnInit {
  eventId: string = '';
  event: any = null;
  athletes: any[] = [];
  relayTeams: any[] = []; 
  isLoading = true;
  isSavingHeats = false;
  isPreparingPrint = false;
  currentUser: any;

  // 表格欄位 (個人項目用)
  displayedColumns: string[] = ['bibNumber', 'name', 'team', 'actions'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private competitionService: CompetitionService,
    private authService: AuthService,
    private formPrinter: CompetitionFormPrinterService,
    private location: Location,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {
    this.currentUser = this.authService.getCurrentUser();
  }

  ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    if (this.eventId) {
      this.loadData();
    }
  }

  loadData() {
    this.isLoading = true;
    
    // 1. 取得項目資訊
    this.competitionService.getEvent(this.eventId).subscribe({
      next: (evt: any) => {
        this.event = evt;
        
        // 2. 取得該項目的所有選手
        this.loadAthletes();
      },
      error: (err: any) => {
        console.error('無法讀取項目', err);
        this.goBack();
      }
    });
  }

  loadAthletes() {
    this.competitionService.getAthletesByEventId(this.eventId).subscribe({
      next: (data: any[]) => {
        this.athletes = data;
        
        // 如果是接力，進行分組處理
        if (this.event && this.event.type === 'relay') {
          this.processRelayTeams(data);
        }
        
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  // ★ 核心邏輯：將選手名單轉為隊伍結構
  processRelayTeams(athletes: any[]) {
    const teamMap = new Map<string, any[]>();

    athletes.forEach(athlete => {
      const teamName = athlete.team;
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, []);
      }
      teamMap.get(teamName)?.push(athlete);
    });

    // 轉回陣列
    this.relayTeams = Array.from(teamMap.entries()).map(([name, members]) => ({
      name,
      members
    }));
  }

  getAthleteDetails(athleteId: string) {
    if (!athleteId) return null;

    // 從已載入的 athletes 陣列中尋找
    return this.athletes.find(a => a._id === athleteId);
  }

  drop(event: CdkDragDrop<any[]>) {
    const prevLane = event.previousContainer.data[event.previousIndex];
    const currLane = event.container.data[event.currentIndex];
    const tempAthleteId = prevLane.athleteId;
    prevLane.athleteId = currLane.athleteId;
    currLane.athleteId = tempAthleteId;
  }
  
  recorderLanes(lanes: any[]) {
    lanes.forEach((lane, index) => {
      lane.laneNumber = index + 1;
    });
  }

  reorderLanes(lanes: any[]) {
    lanes.forEach((lane, index) => {
      lane.laneNumber = index + 1;
    });
  }

  saveHeats() {
    if (!this.event || !this.event.heats) return;

    this.isSavingHeats = true;
    this.competitionService.saveHeats(this.eventId, this.event.heats).subscribe({
      next: () => {
        alert('道次變更已儲存');
        this.isSavingHeats = false;
        this.loadData(); // 重新整理確保一致
      },
      error: (err) => {
        console.error(err);
        alert('儲存失敗');
        this.isSavingHeats = false;
      }
    });
  }

  // ★ 新增：加入接力隊員
  addRelayMember(teamName: string) {
    const dialogRef = this.dialog.open(AthleteDialogComponent, {
      width: '400px',
      data: {
        bibNumber: '', // 接力不需手動輸入號碼
        name: '',
        team: teamName, // 自動帶入隊名
        isRelay: true
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result && result.name) {
        // 自動產生接力 ID: R-隊名-姓名 (保持與匯入邏輯一致)
        const fakeBib = `R-${teamName}-${result.name}`;

        const newAthlete = {
          competitionId: this.event.competitionId,
          eventId: this.eventId,
          name: result.name,
          team: teamName,
          bibNumber: fakeBib
        };

        this.competitionService.createAthlete(newAthlete).subscribe({
          next: () => {
            this.loadAthletes(); // 重整畫面
          },
          error: (err: any) => alert('新增失敗')
        });
      }
    });
  }

  // 修改選手/隊員
  editAthlete(athlete: any) {
    const dialogRef = this.dialog.open(AthleteDialogComponent, {
      width: '400px',
      data: {
        bibNumber: athlete.bibNumber,
        name: athlete.name,
        team: athlete.team,
        isRelay: this.event.type === 'relay'
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        this.competitionService.updateAthlete(athlete._id, result).subscribe({
          next: () => {
            // 更新成功，重新整理資料
            this.loadAthletes();
          },
          error: (err: any) => alert('更新失敗')
        });
      }
    });
  }

  // 刪除選手
  deleteAthlete(athlete: any) {
    if(!confirm(`確定要刪除選手 ${athlete.name} 嗎？`)) return;

    this.competitionService.deleteAthlete(athlete._id).subscribe({
      next: () => {
        this.loadAthletes();
      },
      error: (err: any) => alert('刪除失敗')
    });
  }

  openLaneAssignment() {
    const dialogRef = this.dialog.open(LaneAssignmentDialogComponent, {
      width: '900px', // 寬一點方便操作
      maxWidth: '95vw',
      height: '90vh',
      disableClose: true, // 防止誤觸關閉
      data: {
        eventId: this.eventId,
        eventName: this.event.name,
        eventType: this.event.type,
        // 傳入目前的 heats (如果有)
        existingHeats: this.event.heats
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // 如果有儲存，重新載入資料
        this.loadData();
      }
    });
  }

  canPrintForms(): boolean {
    return this.currentUser?.role === 'admin' || this.currentUser?.role === 'recorder';
  }

  printCurrentRoundForms() {
    if (!this.event || this.isPreparingPrint) return;

    const printWindow = this.formPrinter.openLoadingWindow();
    if (!printWindow) {
      alert('瀏覽器已封鎖列印視窗，請允許此網站開啟彈出式視窗後再試一次。');
      return;
    }

    this.isPreparingPrint = true;
    const continuePrint = () => {
      this.competitionService.getCompetitionById(this.event.competitionId).subscribe({
        next: competition => {
          this.competitionService.getGroups(this.event.competitionId).subscribe({
            next: groups => {
              const group = groups.find((item: any) => item._id === this.event.groupId) || {
                _id: this.event.groupId,
                name: ''
              };
              this.isPreparingPrint = false;
              this.formPrinter.print(printWindow, {
                competition,
                group,
                event: this.event
              });
            },
            error: err => this.handlePrintError(printWindow, err)
          });
        },
        error: err => this.handlePrintError(printWindow, err)
      });
    };

    if (this.event.heats?.length) {
      continuePrint();
      return;
    }

    this.competitionService.initializeHeats(this.eventId).subscribe({
      next: heats => {
        this.event.heats = heats;
        this.event.currentRound = this.event.currentRound || this.event.rounds?.[0] || '決賽';
        continuePrint();
      },
      error: err => this.handlePrintError(printWindow, err)
    });
  }

  private handlePrintError(printWindow: Window, err: any) {
    this.isPreparingPrint = false;
    const message = err.error?.message || '無法準備競賽表單，請確認選手名單與分組資料。';
    this.formPrinter.showError(printWindow, message);
    alert(message);
  }

  goBack() {
    const competitionId = this.route.snapshot.queryParamMap.get('competitionId')
      || this.entityId(this.event?.competitionId);
    const groupId = this.route.snapshot.queryParamMap.get('groupId')
      || this.entityId(this.event?.groupId);

    if (competitionId) {
      this.router.navigate(['/competition', competitionId], {
        queryParams: groupId ? { groupId } : undefined
      });
      return;
    }

    this.location.back();
  }

  private entityId(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value._id || value.id || '';
  }
}
