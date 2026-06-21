import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CompetitionService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  private getHeaders() {
    const token = localStorage.getItem('token');
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      })
    };
  }

  // ==========================================
  // 賽事 (Competition)
  // ==========================================
  getCompetitions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/competitions`, this.getHeaders());
  }

  getCurrentCompetition(): Observable<any> {
    return this.http.get(`${this.apiUrl}/competitions/current`, this.getHeaders());
  }

  getCompetitionById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/competitions/${id}`, this.getHeaders());
  }

  createCompetition(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/competitions`, data, this.getHeaders());
  }

  deleteCompetition(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/competitions/${id}`, this.getHeaders());
  }

  importAthletes(id: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    // 上傳檔案不需要設定 Content-Type為json，Angular會自動處理
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post(`${this.apiUrl}/competitions/${id}/import`, formData, { headers });
  }

  autoAssignPersonnel(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/competitions/${id}/auto-assign`, {}, this.getHeaders());
  }
  
  updateCompetition(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/competitions/${id}`, data, this.getHeaders());
  }

  // ==========================================
  // 組別 (Group)
  // ==========================================
  getGroups(competitionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/competitions/${competitionId}/groups`, this.getHeaders());
  }

  updateGroup(groupId: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/competitions/groups/${groupId}`, data, this.getHeaders());
  }

  // ==========================================
  // 項目 (Event)
  // ==========================================
  getEvents(groupId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/competitions/groups/${groupId}/events`, this.getHeaders());
  }
  
  // ★ 注意：這裡原本叫 getEvent
  getEvent(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/competitions/events/${id}`, this.getHeaders());
  }

  getEventById(eventId: string): Observable<any> {
  return this.http.get(`${this.apiUrl}/competitions/events/${eventId}`, this.getHeaders());
}

  createEvent(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/competitions/events`, data, this.getHeaders());
  }

  updateEvent(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/competitions/events/${id}`, data, this.getHeaders());
  }

  deleteEvent(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/competitions/events/${id}`, this.getHeaders());
  }

  // ==========================================
  // ★ 新增：選手 (Athlete) 相關 API
  // ==========================================
  
  // 取得某項目的所有選手
  getAthletesByEventId(eventId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/competitions/events/${eventId}/athletes`, this.getHeaders());
  }

  // 更新選手資料
  createAthlete(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/competitions/athletes`, data, this.getHeaders());
  }

  updateAthlete(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/competitions/athletes/${id}`, data, this.getHeaders());
  }

  // 刪除選手
  deleteAthlete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/competitions/athletes/${id}`, this.getHeaders());
  }

  initializeHeats(eventId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/competitions/events/${eventId}/initialize-heats`, {}, this.getHeaders());
  }

  saveHeats(eventId: string, heats: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/competitions/events/${eventId}/save-heats`, { heats }, this.getHeaders());
  }

  arrangeNextRound(eventId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/competitions/events/${eventId}/arrange-next`, {}, this.getHeaders());
  }

  // ★ 新增：取得最近成績列表
  getRecentEvents(competitionId?: string): Observable<any> {
    let params = new HttpParams();
    if (competitionId) {
      params = params.set('competitionId', competitionId);
    }

    const options = {
      ...this.getHeaders(),
      params: params
    };
    return this.http.get(`${this.apiUrl}/competitions/events/recent-results`, options);
  }

  // ★ 新增：重置成績
  resetEventResults(eventId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/competitions/events/${eventId}/reset`, {}, this.getHeaders());
  }
}
