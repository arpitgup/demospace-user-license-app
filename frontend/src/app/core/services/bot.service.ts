import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AdminBotsResponse } from '../models/admin-bots-response.model';
import { Observable } from 'rxjs';
import { UpdateBotRequest } from '../models/update-bot-request.model';
import { CreateBotRequest } from '../models/create-bot-request.model';

@Injectable({
  providedIn: 'root',
})
export class BotService {
  public refreshBotsState = signal<boolean>(false);
  public readonly refreshBots = this.refreshBotsState.asReadonly();

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  fetchAllAdminBots(): Observable<AdminBotsResponse[]> {
    return this.http.get<AdminBotsResponse[]>(`${this.apiUrl}/admin/bots`);
  }

  updateBots(
    updateBotRequest: UpdateBotRequest
  ): Observable<AdminBotsResponse[]> {
    return this.http.patch<AdminBotsResponse[]>(
      `${this.apiUrl}/admin/bots/update`,
      updateBotRequest
    );
  }

  createBot(
    updateBotRequest: CreateBotRequest
  ): Observable<AdminBotsResponse[]> {
    return this.http.post<AdminBotsResponse[]>(
      `${this.apiUrl}/admin/bots/create`,
      updateBotRequest
    );
  }
}
