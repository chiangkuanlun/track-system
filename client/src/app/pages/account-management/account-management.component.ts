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
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { HeaderComponent } from '../../components/header/header.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-account-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule
  ],
  templateUrl: './account-management.component.html'
})
export class AccountManagementComponent implements OnInit {
  users: any[] = [];
  displayedColumns = ['name', 'username', 'role', 'groups', 'active', 'password'];
  currentUser: any;
  showCreateForm = false;
  isSaving = false;
  newUser = this.emptyUser();

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
      error: err => alert(err.error?.message || '無法載入帳號資料')
    });
  }

  createUser() {
    const name = this.newUser.name.trim();
    const username = this.newUser.username.trim();
    const password = this.newUser.password;

    if (!name || !username) {
      alert('請填寫姓名與登入帳號');
      return;
    }
    if (!password || password.length < 8) {
      alert('初始密碼至少需要 8 個字元');
      return;
    }

    this.isSaving = true;
    this.authService.register({
      name,
      username,
      password,
      role: this.newUser.role,
      assignedGroupIds: []
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.newUser = this.emptyUser();
        this.showCreateForm = false;
        this.loadUsers();
        alert('使用者建立完成');
      },
      error: err => {
        this.isSaving = false;
        alert(err.error?.message || '建立使用者失敗');
      }
    });
  }

  cancelCreate() {
    this.newUser = this.emptyUser();
    this.showCreateForm = false;
  }

  toggleActive(user: any) {
    if (user._id === this.currentUser._id) {
      user.active = true;
      alert('不能停用目前登入中的管理員帳號');
      return;
    }
    this.authService.updateUser(user._id, { active: user.active }).subscribe({
      error: err => {
        user.active = !user.active;
        alert(err.error?.message || '更新帳號狀態失敗');
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
        alert(`${user.name} 的密碼已更新`);
      },
      error: err => alert(err.error?.message || '密碼更新失敗')
    });
  }

  goBack() {
    this.location.back();
  }

  private emptyUser() {
    return {
      name: '',
      username: '',
      password: '',
      role: 'recorder'
    };
  }
}
