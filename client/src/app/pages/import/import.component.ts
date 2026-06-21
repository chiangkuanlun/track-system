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
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    HeaderComponent
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

  constructor(
    private competitionService: CompetitionService,
    private router: Router,
    private location: Location
  ) {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  onSubmit() {
    // 1. 驗證
    if (!this.competitionData.name || !this.competitionData.dateStart || !this.competitionData.dateEnd) {
      alert('請填寫完整賽事資訊');
      return;
    }

    this.isSubmitting = true;

    // 2. 先建立賽事
    this.competitionService.createCompetition(this.competitionData).subscribe({
      next: (comp: any) => {
        const newCompetitionId = comp._id;
        console.log('賽事建立成功 ID:', newCompetitionId);

        // 3. 如果有選檔案，接著上傳
        if (this.selectedFile) {
          this.uploadFile(newCompetitionId);
        } else {
          alert('賽事已建立 (無匯入名單)');
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err: any) => {
        console.error(err);
        alert('建立賽事失敗，請檢查網路或伺服器');
        this.isSubmitting = false;
      }
    });
  }

  uploadFile(competitionId: string) {
    if (!this.selectedFile) return;

    this.competitionService.importAthletes(competitionId, this.selectedFile).subscribe({
      next: (res: any) => {
        alert(`成功！賽事已建立並匯入名單。\n(${res.message})`);
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        console.error(err);
        alert('賽事已建立，但「名單匯入失敗」。\n請確認 Excel 格式正確。');
        this.router.navigate(['/dashboard']); // 還是跳轉，因為賽事已經建好了
      }
    });
  }

  goBack() {
    this.location.back();
  }
}
