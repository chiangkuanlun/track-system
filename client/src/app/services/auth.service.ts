import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // 請確認這裡的 IP 與 Port
  private apiUrl = '/api/users';
  
  private userKey = 'currentUser';
  private tokenKey = 'token';

  public currentUserSubject: BehaviorSubject<any>;
  public currentUser$: Observable<any>;

  constructor(private http: HttpClient, private router: Router) {
    const storedUser = this.getStoredUser();
    this.currentUserSubject = new BehaviorSubject<any>(storedUser);
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  private getStoredUser(): any {
    try {
      const userStr = localStorage.getItem(this.userKey);
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error('解析使用者資料失敗', e);
      return null;
    }
  }

  register(user: any): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    return this.http.post(`${this.apiUrl}/register`, user, { headers });
  }

  bootstrap(user: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/bootstrap`, user);
  }

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap((response: any) => {
        if (response.token) {
          localStorage.setItem(this.tokenKey, response.token);
          
          let user = null;
          if (response.user) {
            user = response.user;
          } else if (response.role && response.username) {
            user = response;
          }

          if (user) {
            localStorage.setItem(this.userKey, JSON.stringify(user));
            this.currentUserSubject.next(user);
          }
        }
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  getUser(): any {
    return this.currentUserSubject.value;
  }
  
  getRecorders(): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    return this.http.get(`${this.apiUrl}/recorders`, { headers });
  }

  // ★ 新增：更新使用者資料 (用於分派權限)
  updateUser(userId: string, data: any): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    // 注意：假設後端有 PUT /api/users/:id 的路由
    // 如果您的後端路由不同，可能需要調整
    return this.http.put(`${this.apiUrl}/${userId}`, data, { headers });
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
