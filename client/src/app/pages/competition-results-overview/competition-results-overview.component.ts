import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; // ★ 1. 新增引入

import { CompetitionService } from '../../services/competition.service';
import { HeaderComponent } from '../../components/header/header.component';
import { EventResultDialogComponent } from '../../components/event-result-dialog/event-result-dialog.component';

@Component({
  selector: 'app-competition-results-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule, // ★ 2. 加入 imports
    HeaderComponent
  ],
  templateUrl: './competition-results-overview.component.html'
})
export class CompetitionResultsOverviewComponent implements OnInit {
  competitionId = '';
  competitionName = '';
  
  groups: any[] = [];
  selectedGroupId: string = '';
  currentEvents: any[] = [];
  
  isLoading = true;
  isLoadingEvents = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private competitionService: CompetitionService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.competitionId = this.route.snapshot.paramMap.get('id') || '';
    if (this.competitionId) {
      this.loadCompetitionAndGroups();
    }
  }

  loadCompetitionAndGroups() {
    this.isLoading = true;
    
    this.competitionService.getCurrentCompetition().subscribe(comp => {
      if (comp && comp._id === this.competitionId) {
        this.competitionName = comp.name;
      }
    });

    this.competitionService.getGroups(this.competitionId).subscribe({
      next: (groups) => {
        this.groups = groups;
        this.isLoading = false;

        if (this.groups.length > 0) {
          this.selectGroup(this.groups[0]._id);
        }
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  selectGroup(groupId: string) {
    this.selectedGroupId = groupId;
    this.isLoadingEvents = true;
    this.currentEvents = [];

    this.competitionService.getEvents(groupId).subscribe({
      next: (events) => {
        this.currentEvents = events.map((event: any) => {
          return {
            ...event,
            roundButtons: this.generateRoundButtons(event)
          };
        });
        this.isLoadingEvents = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoadingEvents = false;
      }
    });
  }

generateRoundButtons(event: any) {
    // 1. 收集所有可能的輪次名稱 (使用 Set 去除重複)
    const roundSet = new Set<string>();

    // A. 來自設定的輪次 (例如: ['預賽', '決賽'])
    if (event.rounds && event.rounds.length > 0) {
      event.rounds.forEach((r: string) => roundSet.add(r));
    }

    // B. 來自當前狀態的輪次 (currentRound)
    if (event.currentRound) {
      roundSet.add(event.currentRound);
    }

    // C. 來自歷史存檔的輪次 (roundResults)
    if (event.roundResults && event.roundResults.length > 0) {
      event.roundResults.forEach((r: any) => {
        if (r.roundName) roundSet.add(r.roundName);
      });
    }

    // D. 如果完全沒資料，預設給一個 "決賽"
    if (roundSet.size === 0) {
      roundSet.add('決賽');
    }

    // 2. 定義輪次排序權重 (讓按鈕順序正確：預賽 -> 準決賽 -> 決賽)
    const priority = ['資格賽', '預賽', '準決賽', '決賽'];
    
    const sortedRounds = Array.from(roundSet).sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      // 如果都在清單內，照順序；如果不在清單內(例如自訂名稱)，排最後
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    // 3. 生成按鈕狀態
    return sortedRounds.map((roundName: string) => {
      let hasResult = false;
      let dataFound = false; // 標記是否找得到該輪次的結構(即使沒成績)

      // 檢查歷史成績
      const inHistory = event.roundResults?.find((r: any) => r.roundName === roundName);
      if (inHistory) {
        dataFound = true;
        if (this.checkHeatsResult(inHistory.heats)) hasResult = true;
      }

      // 檢查當前成績
      if (event.currentRound === roundName) {
        dataFound = true; // 只要是當前輪次，就代表有結構
        if (this.checkHeatsResult(event.heats)) hasResult = true;
      }

      return {
        name: roundName,
        hasResult: hasResult,
        // ★ 邏輯放寬：只要「有成績」或者「有該輪次的資料結構(已分組)」，就讓按鈕亮起來
        // 這樣即使還沒輸入秒數，也能點進去看名單
        isActive: hasResult || dataFound 
      };
    });
  }

  checkHeatsResult(heats: any[]): boolean {
    if (!heats || heats.length === 0) return false;
    return heats.some((heat: any) => 
      heat.lanes && heat.lanes.some((lane: any) => lane.result && lane.result !== '')
    );
  }

  // ★ 3. 新增此函式，解決 HTML 裡不能寫箭頭函式的問題
  hasNoResults(roundButtons: any[]): boolean {
    if (!roundButtons || roundButtons.length === 0) return true;
    return roundButtons.every((r: any) => !r.isActive);
  }

  openResultDialog(event: any, roundName: string) {
    const group = this.groups.find(g => g._id === this.selectedGroupId);
    const groupName = group ? group.name : '';

    this.dialog.open(EventResultDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      data: {
        eventId: event._id,
        eventName: event.name,
        groupName: groupName,
        targetRound: roundName
      }
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}