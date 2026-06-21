import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule,Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';

import { AuthService } from '../../services/auth.service';
import { CompetitionService } from '../../services/competition.service';
import { HeaderComponent } from '../../components/header/header.component';
import { EventResultDialogComponent } from '../../components/event-result-dialog/event-result-dialog.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatListModule,
    MatChipsModule,
    HeaderComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  user: any = null;
  recentEvents: any[] = [];
  isLoadingRecent = false; // 預設改為 false，等確定要載入時再 true
  currentCompetition: any = null;

  constructor(
    private authService: AuthService,
    private competitionService: CompetitionService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit() {
    this.user = this.authService.getCurrentUser();
    // 流程調整：先載入當前賽事，成功後 -> 再載入該賽事的成績
    this.loadCurrentCompetition();
  }

  loadCurrentCompetition() {
    this.competitionService.getCurrentCompetition().subscribe({
      next: (comp) => {
        this.currentCompetition = comp;
        
        // ★ 重點：取得賽事資料後，如果有 ID，就去載入該賽事的成績
        if (this.currentCompetition && this.currentCompetition._id) {
          this.loadRecentResults(this.currentCompetition._id);
        }
      },
      error: (err) => {
        console.error('無法載入當前賽事', err);
        this.currentCompetition = null;
      }
    });
  }

  // ★ 修改：接收 competitionId 參數
  loadRecentResults(competitionId: string) {
    this.isLoadingRecent = true;
    this.competitionService.getRecentEvents(competitionId).subscribe({
      next: (data) => {
        this.recentEvents = data;
        this.isLoadingRecent = false;
        // console.log('最新成績列表:', data); // 除錯用
      },
      error: (err) => {
        console.error('無法載入最新成績', err);
        this.isLoadingRecent = false;
      }
    });
  }

  deleteCompetition() {
    if (!this.currentCompetition) return;
    
    if (confirm(`警告：確定要刪除賽事「${this.currentCompetition.name}」嗎？\n所有的分組、成績與選手資料都將被永久移除！`)) {
      this.competitionService.deleteCompetition(this.currentCompetition._id).subscribe({
        next: () => {
          alert('賽事已刪除');
          this.currentCompetition = null;
          this.recentEvents = []; // 清空列表
        },
        error: (err) => {
          console.error(err);
          alert('刪除失敗，請檢查權限');
        }
      });
    }
  }

  openResultDialog(event: any) {
    const dialogRef = this.dialog.open(EventResultDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      data: {
        eventId: event._id,
        eventName: event.name,
        groupName: event.groupId?.name
      }
    });

    // 如果使用者在 Dialog 按下「前往編輯」，則跳轉
    dialogRef.afterClosed().subscribe(result => {
      if (result === 'edit') {
        this.router.navigate(['/competition/event', event._id, 'result']);
      }
    });
  }
}
