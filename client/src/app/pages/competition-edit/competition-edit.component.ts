import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
  selector: 'app-competition-edit',
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
  templateUrl: './competition-edit.component.html'
})
export class CompetitionEditComponent implements OnInit {
  competitionId: string = '';
  competitionData: any = {}; // 這裡使用 competitionData，對應 HTML
  isLoading = true;
  isSubmitting = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private competitionService: CompetitionService,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.competitionId = this.route.snapshot.paramMap.get('id') || '';
    if (this.competitionId) {
      this.loadData();
    } else {
      this.location.back();
    }
  }

  loadData() {
    this.isLoading = true;
    this.competitionService.getCompetitionById(this.competitionId).subscribe({
      next: (data) => {
	console.log('賽事資料讀取成功:', data);
        this.competitionData = {
	  ...data,
	  dateStart: data.dateStart ? new Date(data.dateStart) : null,
	  dateEnd: data.dateEnd ? new Date(data.dateEnd) : null
	};
        this.isLoading = false;
	this.cdr.detectChanges();
      },
      error: (err) => {
	console.error('讀取賽事失敗:', err);
        alert('無法載入賽事資料');
	this.isLoading = false;
	this.cdr.detectChanges();
        this.location.back();
      }
    });
  }

  onSubmit() {
    this.isSubmitting = true;
    this.competitionService.updateCompetition(this.competitionId, this.competitionData).subscribe({
      next: () => {
        alert('更新成功！');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
	console.error(err);
        alert('更新失敗');
        this.isSubmitting = false;
	this.cdr.detectChanges();
      }
    });
  }

  goBack() {
    this.location.back();
  }
}
