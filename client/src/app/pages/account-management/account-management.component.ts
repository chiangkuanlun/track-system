import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { HeaderComponent } from '../../components/header/header.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-account-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule, HeaderComponent, MatButtonModule, MatCardModule,
    MatIconModule, MatTableModule, MatInputModule, MatFormFieldModule,
    MatSlideToggleModule
  ],
  templateUrl: './account-management.component.html'
})
export class AccountManagementComponent implements OnInit {
  users: any[] = [];
  displayedColumns = ['name', 'username', 'role', 'groups', 'active', 'password'];
  currentUser: any;

  constructor(
    private authService: AuthService,
    private router: Router,
    private location: Location
  ) {
    this.currentUser = authService.getCurrentUser();
  }

  ngOnInit() {
    if (this.currentUser?.role !== 'admin') {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadUsers();
  }

  loadUsers() {
    this.authService.getUsers().subscribe({
      next: users => this.users = users.map((user: any) => ({ ...user, newPassword: '' })),
      error: err => alert(err.error?.message || '讀取帳號失敗')
    });
  }

  toggleActive(user: any) {
    if (user._id === this.currentUser._id) {
      user.active = true;
      alert('不可停用目前登入的管理員帳號');
      return;
    }
    this.authService.updateUser(user._id, { active: user.active }).subscribe({
      error: err => {
        user.active = !user.active;
        alert(err.error?.message || '更新帳號失敗');
      }
    });
  }

  resetPassword(user: any) {
    if (!user.newPassword || user.newPassword.length < 8) {
      alert('新密碼至少需要 8 個字元');
      return;
    }
    this.authService.updateUser(user._id, { password: user.newPassword }).subscribe({
      next: () => {
        user.newPassword = '';
        alert(`「${user.name}」的密碼已更新`);
      },
      error: err => alert(err.error?.message || '密碼更新失敗')
    });
  }

  goBack() {
    this.location.back();
  }
}
