import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';

import { CompetitionService } from '../../services/competition.service';
import { HeaderComponent } from '../../components/header/header.component';

@Component({
  selector: 'app-competition-result',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTabsModule,
    MatTableModule
  ],
  templateUrl: './competition-result.component.html',
  styleUrls: ['./competition-result.component.scss']
})
export class CompetitionResultComponent implements OnInit {
  eventId: string = '';
  event: any = null;
  athletes: any[] = [];
  isLoading = true;
  isSaving = false;

  statusOptions = [
    { value: 'Normal', label: '正常' },
    { value: 'DNS', label: '未起跑 (DNS)' },
    { value: 'DNF', label: '未完賽 (DNF)' },
    { value: 'DQ', label: '取消資格 (DQ)' }
  ];

  displayedColumns: string[] = ['lane', 'bib', 'name', 'team', 'status', 'result', 'rank'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private competitionService: CompetitionService,
    private location: Location
  ) {}

  ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    if (this.eventId) {
      this.loadData();
    }
  }

  loadData() {
    this.isLoading = true;
    
    // 1. 取得 Event 資料 (包含 heats 和已輸入的成績)
    this.competitionService.getEvent(this.eventId).subscribe({
      next: (evt) => {
        this.event = evt;
        
        // 2. 取得選手詳細資料 (用來顯示名字)
        if (!evt.heats || evt.heats.length === 0) {
          this.competitionService.initializeHeats(this.eventId).subscribe({
            next: () => this.loadData(),
            error: err => {
              this.isLoading = false;
              alert(err.error?.message || '無法建立決賽選手編排');
            }
          });
          return;
        }
        this.loadAthletes();
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
        alert('無法載入資料');
        this.goBack();
      }
    });
  }

  // 輔助：透過 ID 找選手資料
  private loadAthletes() {
    this.competitionService.getAthletesByEventId(this.eventId).subscribe({
      next: aths => {
        this.athletes = aths;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  getAthlete(athleteId: string) {
    if (!athleteId) return null;
    return this.athletes.find(a => a._id === athleteId);
  }

  // 自動計算名次 (簡單版：依成績排序)
  // 注意：這只是輔助，通常還是要人工確認
  autoRank(heatIndex: number) {
    const heat = this.event.heats[heatIndex];
    if (!heat) return;

    // 取得所有有成績且狀態正常的道次
    const validLanes = heat.lanes.filter((l: any) => 
      l.athleteId && l.status === 'Normal' && l.result
    );

    // 排序邏輯：徑賽(track)通常數字越小越好；田賽(field)數字越大越好
    // 這裡先預設為徑賽邏輯 (秒數少者贏)
    // 若要支援田賽，需判斷 this.event.type === 'field'
    const isField = this.event.type === 'field';
    
    validLanes.sort((a: any, b: any) => {
      const resA = parseFloat(a.result);
      const resB = parseFloat(b.result);
      if (isNaN(resA)) return 1;
      if (isNaN(resB)) return -1;
      return isField ? resB - resA : resA - resB;
    });

    // 填入名次
    validLanes.forEach((lane: any, index: number) => {
      lane.rank = index + 1;
    });
  }

  save() {
    this.isSaving = true;
    // 使用 saveHeats API 儲存完整的 heats 結構 (含成績)
    this.competitionService.saveHeats(this.eventId, this.event.heats).subscribe({
      next: () => {
        alert('成績儲存成功！');
        this.isSaving = false;
      },
      error: (err) => {
        console.error(err);
        alert('儲存失敗');
        this.isSaving = false;
      }
    });
  }

  // ★ 新增：重置按鈕邏輯
  resetResults() {
    if (!confirm('【危險操作】\n確定要清空此項目的「所有成績」與「晉級紀錄」嗎？\n\n注意：\n1. 選手分組與道次會保留。\n2. 所有已輸入的秒數與名次將消失。\n3. 此動作無法復原。')) {
      return;
    }

    this.isLoading = true;
    this.competitionService.resetEventResults(this.eventId).subscribe({
      next: (updatedEvent) => {
        alert('成績已重置完成，資料庫已清洗乾淨。');
        // 重新載入頁面資料
        this.loadData();
      },
      error: (err) => {
        console.error(err);
        alert('重置失敗');
        this.isLoading = false;
      }
    });
  }

  goBack() {
    this.location.back();
  }
}
