import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  user: any = null;

  constructor(public authService: AuthService) {}

  ngOnInit() {
    // 訂閱使用者狀態，這會自動更新 Header
    this.authService.currentUser$.subscribe(user => {
      console.log('Header 接收到使用者更新:', user); // 除錯用
      this.user = user;
    });
  }

  getRoleName(role: string): string {
    if (!role) return '未知身分';
    return (role === 'admin' || role === 'Admin') ? '系統管理員' : '記錄人員';
  }

  logout() {
    this.authService.logout();
  }
}
