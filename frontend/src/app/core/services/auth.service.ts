import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userEmail = 'tushank@1987984870407.altostrat.com';

  /**
   * Returns the authenticated user's email.
   * @returns The user's email string or null if not authenticated.
   */
  getUserEmail(): string | null {
    return this.userEmail;
  }
}