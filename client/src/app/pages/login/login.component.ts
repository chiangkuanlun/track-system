import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service'; // <--- 匯入 AuthService
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatCardModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatButtonModule,
    HttpClientModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  username = '';
  password = '';

  constructor(private authService: AuthService, private router: Router) {}

  onLogin() {
    if (!this.username || !this.password) {
      alert('請輸入帳號密碼');
      return;
    }

    // 呼叫後端 API 進行登入
    this.authService.login({ username: this.username, password: this.password })
      .subscribe({
        next: (res) => {
          console.log('登入成功', res);
          // 導向儀表板
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          console.error('登入失敗', err);
          alert('登入失敗：' + (err.error.message || '伺服器錯誤'));
        }
      });
  }

  // 用於初始化第一個管理員帳號 (開發用)
  quickRegister() {
    const adminData = {
      name: '系統管理員',
      username: 'admin',
      password: 'ChangeMe123!'
    };

    this.authService.bootstrap(adminData).subscribe({
      next: (res) => {
        alert('管理員帳號建立成功！\n帳號: admin\n初始密碼: ChangeMe123!\n登入後請立即改為專用密碼。');
        this.username = 'admin';
        this.password = 'ChangeMe123!';
      },
      error: (err) => {
        alert('建立失敗 (帳號可能已存在): ' + err.error.message);
      }
    });
  }
}
