import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userEmail = environment.emailId;

  /**
   * Returns the authenticated user's email.
   * @returns The user's email string or null if not authenticated.
   */
  getUserEmail(): string | null {
    return this.userEmail;
  }
}