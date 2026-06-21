import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { HeaderComponent } from '../../components/header/header.component';
import { CompetitionService } from '../../services/competition.service';

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatDatepickerModule,
    MatNativeDateModule, MatIconModule, HeaderComponent
  ],
  templateUrl: './import.component.html'
})
export class ImportComponent {
  competitionData = {
    name: '',
    location: '',
    dateStart: '',
    dateEnd: ''
  };
  selectedFile: File | null = null;
  isSubmitting = false;
  importResult = '';

  constructor(
    private competitionService: CompetitionService,
    private router: Router,
    private location: Location
  ) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || null;
  }

  onSubmit() {
    const data = this.competitionData;
    if (!data.name || !data.location || !data.dateStart || !data.dateEnd) {
      alert('請填寫賽事名稱、地點與起訖日期');
      return;
    }

    this.isSubmitting = true;
    this.importResult = '';
    this.competitionService.createCompetition(data).subscribe({
      next: (competition: any) => {
        if (this.selectedFile) {
          this.uploadFile(competition._id);
          return;
        }
        alert('賽事已建立（尚未匯入名單）');
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.isSubmitting = false;
        alert(err.error?.message || '建立賽事失敗，請檢查欄位資料');
      }
    });
  }

  private uploadFile(competitionId: string) {
    if (!this.selectedFile) return;
    this.competitionService.importAthletes(competitionId, this.selectedFile).subscribe({
      next: (res: any) => {
        this.importResult = [
          res.message,
          `略過重複：${res.skipped || 0} 筆`,
          `失敗：${res.failed || 0} 筆`,
          res.assignedGroups ? `自動分派：${res.assignedGroups} 組` : ''
        ].filter(Boolean).join('\n');
        alert(`賽事與名單匯入完成\n${this.importResult}`);
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        const expected = err.error?.expectedColumns?.join('、');
        const message = err.error?.message || '名單匯入失敗';
        this.importResult = expected ? `${message}\n建議欄位：${expected}` : message;
        this.isSubmitting = false;
        alert(this.importResult);
      }
    });
  }

  goBack() {
    this.location.back();
  }
}
