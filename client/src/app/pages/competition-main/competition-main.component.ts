import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';

import { CompetitionService } from '../../services/competition.service';
import { AuthService } from '../../services/auth.service'; // 引入 AuthService
import { HeaderComponent } from '../../components/header/header.component';
import { EventDialogComponent } from '../../components/event-dialog/event-dialog.component';

@Component({
  selector: 'app-competition-main',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatTooltipModule,
    MatMenuModule,
    FormsModule,
    MatDividerModule,
    HeaderComponent
  ],
  templateUrl: './competition-main.component.html',
  styleUrls: ['./competition-main.component.scss']
})
export class CompetitionMainComponent implements OnInit {
  competitionId: string = '';
  groups: any[] = [];
  selectedGroup: any = null;
  events: any[] = [];
  isLoading = true;

  // 記錄人員分派相關
  recorders: any[] = [];
  isAssigningRecorder = false;
  isCreatingRecorder = false;
  newRecorderData = { name: '', username: '', password: '' };
  currentUser: any = null;

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private competitionService: CompetitionService,
    private authService: AuthService, // 注入 AuthService
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.competitionId = this.route.snapshot.paramMap.get('id') || '';
    if (this.competitionId) {
      this.loadGroups();
    }
  }

  loadGroups() {
    this.isLoading = true;
    this.competitionService.getGroups(this.competitionId).subscribe({
      next: (data) => {
        this.groups = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  selectGroup(group: any) {
    this.selectedGroup = group;
    this.isAssigningRecorder = false; // 切換組別時關閉選單
    this.loadEvents(group._id);
  }

  loadEvents(groupId: string) {
    this.competitionService.getEvents(groupId).subscribe({
      next: (data) => {
        this.events = data;
      },
      error: (err) => console.error(err)
    });
  }

  // --- 分派人員邏輯 (重寫) ---

  toggleRecorderMenu() {
    this.isAssigningRecorder = !this.isAssigningRecorder;
    if (this.isAssigningRecorder) {
      this.loadRecorders();
    }
  }

  loadRecorders() {
    this.authService.getRecorders().subscribe({
      next: (data) => {
        this.recorders = data;
        // 檢查每位記錄人員是否已負責目前選中的組別
        this.checkAssignments();
      },
      error: (err) => console.error('無法載入人員列表', err)
    });
  }

  checkAssignments() {
    if (!this.selectedGroup) return;
    
    this.recorders.forEach(recorder => {
      const assignedIds = recorder.assignedGroupIds || [];
      // 判斷此記錄人員是否擁有目前 selectedGroup 的 ID
      recorder.isAssigned = assignedIds.includes(this.selectedGroup._id);
    });
  }

  // ★ 核心修復：切換指派狀態並立即存檔
  toggleAssignment(recorder: any) {
    if (!this.selectedGroup) return;

    const groupId = this.selectedGroup._id;
    let assignedIds = recorder.assignedGroupIds || [];

    if (recorder.isAssigned) {
      // 取消指派：從陣列中移除
      assignedIds = assignedIds.filter((id: string) => id !== groupId);
      recorder.isAssigned = false;
    } else {
      // 新增指派：加入陣列
      assignedIds.push(groupId);
      recorder.isAssigned = true;
    }

    // 更新本地暫存
    recorder.assignedGroupIds = assignedIds;

    // ★ 呼叫 API 寫入資料庫
    console.log(`正在更新 ${recorder.name} 的權限...`, assignedIds);
    this.authService.updateUser(recorder._id, { assignedGroupIds: assignedIds }).subscribe({
      next: () => {
        console.log('權限更新成功');
        // 不需要 alert，使用者體驗較順暢，但可以在這裡加 Toast 提示
      },
      error: (err) => {
        console.error('權限更新失敗', err);
        alert('權限儲存失敗，請重試');
        // 失敗時回復勾選狀態 (Rollback)
        recorder.isAssigned = !recorder.isAssigned;
      }
    });
  }

  getAssignedRecordersNames(): string {
    if (!this.recorders || this.recorders.length === 0) return '';
    const assigned = this.recorders.filter(r => r.isAssigned);
    if (assigned.length === 0) return '';
    return '負責人: ' + assigned.map(r => r.name).join(', ');
  }

  createRecorder() {
    if (!this.newRecorderData.name || !this.newRecorderData.username || !this.newRecorderData.password) {
      alert('請填寫完整資料');
      return;
    }

    const newUser = {
      ...this.newRecorderData,
      role: 'recorder',
      assignedGroupIds: [this.selectedGroup._id]
    };

    this.authService.register(newUser).subscribe({
      next: () => {
        alert(`記錄人員已建立，僅可管理「${this.selectedGroup.name}」`);
        this.isCreatingRecorder = false;
        this.newRecorderData = { name: '', username: '', password: '' };
        this.loadRecorders(); // 重新載入列表
      },
      error: (err) => alert('建立失敗: ' + (err.error?.message || err.message))
    });
  }

  autoAssignPersonnel() {
    this.competitionService.autoAssignPersonnel(this.competitionId).subscribe({
      next: (result) => {
        alert(result.message);
        this.loadGroups();
        if (this.isAssigningRecorder) this.loadRecorders();
      },
      error: (err) => alert(err.error?.message || '自動分派失敗')
    });
  }

  // --- 其他原有功能 ---

  addEvent() {
    if (!this.selectedGroup) return;
    const dialogRef = this.dialog.open(EventDialogComponent, {
      width: '500px',
      data: { competitionId: this.competitionId, groupId: this.selectedGroup._id }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.competitionService.createEvent(result).subscribe({
          next: () => this.loadEvents(this.selectedGroup._id),
          error: (err) => alert(err.error?.message || '新增項目失敗')
        });
      }
    });
  }

  editEvent(event: any) {
    const dialogRef = this.dialog.open(EventDialogComponent, {
      width: '500px',
      data: { 
        competitionId: this.competitionId, 
        groupId: this.selectedGroup._id,
        event: event // 傳入現有資料
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.competitionService.updateEvent(event._id, result).subscribe({
          next: () => this.loadEvents(this.selectedGroup._id),
          error: (err) => alert(err.error?.message || '更新項目失敗')
        });
      }
    });
  }

  deleteEvent(event: any) {
    if (!confirm(`確定要刪除 ${event.name} 嗎？`)) return;
    this.competitionService.deleteEvent(event._id).subscribe({
      next: () => this.loadEvents(this.selectedGroup._id),
      error: () => alert('刪除失敗')
    });
  }

  toggleEventType(event: any) {
    const types = ['track', 'field', 'relay'];
    const currentIdx = types.indexOf(event.type);
    const nextType = types[(currentIdx + 1) % types.length];
    
    this.competitionService.updateEvent(event._id, { type: nextType }).subscribe({
      next: () => {
        event.type = nextType; // 樂觀更新
      },
      error: () => alert('更新失敗')
    });
  }

  // 賽制切換
  changeEventRounds(event: any, roundType: string) {
    let rounds: string[] = [];
    switch(roundType) {
      case 'final': rounds = ['決賽']; break;
      case 'pre-final': rounds = ['預賽', '決賽']; break;
      case 'pre-semi-final': rounds = ['預賽', '準決賽', '決賽']; break;
      case 'pre-quarter-semi-final': rounds = ['預賽', '複賽', '準決賽', '決賽']; break;
    }

    this.competitionService.updateEvent(event._id, { rounds }).subscribe({
      next: () => {
        event.rounds = rounds;
      },
      error: () => alert('更新失敗')
    });
  }

  isRoundSelected(event: any, roundType: string): boolean {
    const r = event.rounds || [];
    if (roundType === 'final') return r.length === 1 && r[0] === '決賽';
    if (roundType === 'pre-final') return r.length === 2;
    if (roundType === 'pre-semi-final') return r.length === 3;
    if (roundType === 'pre-quarter-semi-final') return r.length === 4;
    return false;
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
