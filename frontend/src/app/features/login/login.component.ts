import {
  AfterViewInit,
  Component,
  inject,
  NgZone,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';

import { jwtDecode } from 'jwt-decode';
import { timer } from 'rxjs';
import { LoginService } from '../../core/services/login.service';
import { LoginRequest } from '../../core/models/login-request.model';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialog } from '../../shared/dialogs/error-dialog/error-dialog';

declare const google: any;

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  user: any = null;
  token: string | null = null;
  private ngZone = inject(NgZone);
  private router = inject(Router);
  isGoogleLoginInitialized: boolean = false;
  readonly loginService = inject(LoginService);
  readonly dialog = inject(MatDialog);

  ngOnInit(): void {
    this.initializeGoogleLogin();
    timer(1000).subscribe(() => {
      if (this.isGoogleLoginInitialized === false) {
        this.initializeGoogleLogin();
      }
    });
  }
  initializeGoogleLogin() {
    if (typeof google === 'undefined') {
      return;
    }
    sessionStorage.clear();
    google.accounts.id.initialize({
      client_id:
        '385039775654-deso4nja1vond0f98j0p4vic6uvt91su.apps.googleusercontent.com',
      hosted_domain: '1987984870407.altostrat.com',
      callback: (response: any) => this.handleCredentialResponse(response),
    });
    google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      { theme: 'outline', size: 'large' }
    );
    this.isGoogleLoginInitialized = true;
  }

  handleCredentialResponse(response: any): void {
    this.ngZone.run(() => {
      const token = response.credential;
      if (token) {
        this.callUserLoginApi(token);
      }
    });
  }
  callUserLoginApi(token: string) {
    const request: LoginRequest = { token: token };
    this.loginService.userLogin(request).subscribe({
      next: (res) => {
        if (res.token_valid && res.user_details && res.user_details.email) {
          sessionStorage.setItem('userEmail', res.user_details.email);
          sessionStorage.setItem('userToken', res.user_details.user_token);
          this.router.navigate(['/admin']);
        } else {
          this.showErrorDialog(
            'Unable to retrive user details. Please try again'
          );
        }
      },
      error: (error) => {
        this.showErrorDialog(error?.error?.detail || 'Something went wrong');
      },
    });
  }

  showErrorDialog(message: string) {
    this.dialog.open(ErrorDialog, {
      width: 'auto',
      minWidth: '41.86rem',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        message: message,
      },
    });
  }
}
