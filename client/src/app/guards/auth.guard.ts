import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 檢查是否有 Token (代表已登入)
  if (authService.getToken()) {
    return true;
  }

  // 沒有 Token 就踢回登入頁
  router.navigate(['/login']);
  return false;
};
