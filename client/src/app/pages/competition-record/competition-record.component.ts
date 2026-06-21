import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';

import { CompetitionService } from '../../services/competition.service';
import { AuthService } from '../../services/auth.service';
import { HeaderComponent } from '../../components/header/header.component';
import { ArrangeNextRoundDialogComponent } from '../../components/arrange-next-round-dialog/arrange-next-round-dialog.component';

@Component({
  selector: 'app-competition-record',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDividerModule,
    MatTooltipModule,
    HeaderComponent
  ],
  templateUrl: './competition-record.component.html',
  styleUrls: ['./competition-record.component.scss']
})
export class CompetitionRecordComponent implements OnInit {
  competitionId: string = '';
  groups: any[] = [];
  isLoading = true;
  currentUser: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private competitionService: CompetitionService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.competitionId = this.route.snapshot.paramMap.get('id') || '';
    this.currentUser = this.authService.getCurrentUser();
    
    if (this.competitionId) {
      this.loadGroupsAndEvents();
    }
  }

  loadGroupsAndEvents() {
    this.isLoading = true;
    
    this.competitionService.getGroups(this.competitionId).subscribe({
      next: (groupsData) => {
        let targetGroups = groupsData;
        const role = this.currentUser?.role;
        const isAdmin = role === 'admin' || role === 'Admin';

        // 如果不是管理員，執行過濾
        if (!isAdmin) {
          const assignedIds = this.currentUser?.assignedGroupIds || [];
          
          targetGroups = groupsData.filter((group: any) => {
            // 寬鬆比對 (轉字串)
            return assignedIds.some((id: any) => String(id) === String(group._id));
          });
        }
        const promises = targetGroups.map((group: any) => 
          new Promise((resolve) => {
            this.competitionService.getEvents(group._id).subscribe(events => {
              group.events = events;
              resolve(group);
            });
          })
        );

        Promise.all(promises).then((groupsWithEvents: any[]) => {
          this.groups = groupsWithEvents;
          this.isLoading = false;
        });
      },
      error: (err) => {
        console.error('無法載入組別', err);
        this.isLoading = false;
      }
    });
  }

  hasInitialHeats(event: any): boolean {
    return event.heats && event.heats.length > 0;
  }

  isMultiRoundEvent(event: any): boolean {
    return event.rounds && event.rounds.length > 1;
  }

  getAdvancementRule(event: any): string {
    const r = event.rounds || [];

    // A. 預賽-準決賽-決賽
    if (r.length === 3 && r[0] === '預賽' && r[1] === '準決賽') {
      return '賽制: 預賽-準決賽-決賽\n規則: 預賽取前16名晉級準決賽、準決賽取前8名晉級決賽';
    }

    // B. 預賽-決賽
    if (r.length === 2 && r[0] === '預賽' && r[1] === '決賽') {
      return '賽制: 預賽-決賽\n規則: 預賽取前8名晉級決賽';
    }

    // C. 其他狀況 (如直接決賽)
    if (r.length === 1 && r[0] === '決賽') {
      return '賽制: 直接決賽\n規則: 依成績直接排名';
    }

    return '未設定或特殊賽制';
  }

  // ★ 2. 顯示成績建立狀態
  getResultStatus(event: any): string | null {
    // 檢查是否有任何成績被輸入
    const hasResults = event.heats?.some((heat: any) =>
      heat.lanes?.some((lane: any) => lane.result && lane.result !== '')
    );

    if (!hasResults) return null;

    // 根據 currentRound 顯示對應文字
    const current = event.currentRound || (event.rounds ? event.rounds[0] : '');

    if (current) {
      return `已建立${current}成績`;
    }

    return '已建立成績';
  }

  // ★ 3. 判斷是否隱藏「下一輪」按鈕 (如果是決賽且已建立成績)
  shouldHideNextRoundBtn(event: any): boolean {
    const current = event.currentRound;

    // 如果現在是「決賽」，而且已經有成績了，就隱藏按鈕
    if (current === '決賽') {
      const hasResults = event.heats?.some((heat: any) =>
        heat.lanes?.some((lane: any) => lane.result && lane.result !== '')
      );
      if (hasResults) return true;
    }

    return false;
  }

  goToResultEntry(event: any) {
    this.router.navigate(['/competition/event', event._id, 'result']);
  }

  goToNextRoundArrangement(event: any) {
    // 1. 先取得該項目的所有選手資料 (為了 Dialog 顯示名字)
    this.competitionService.getAthletesByEventId(event._id).subscribe(athletes => {

      const dialogRef = this.dialog.open(ArrangeNextRoundDialogComponent, {
        width: '600px',
        data: {
          event: event,
          currentRound: event.currentRound || event.rounds[0],
          athletes: athletes
        }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          alert('晉級編排完成！');
          // 重新載入資料以更新畫面
          this.loadGroupsAndEvents();
        }
      });

    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
