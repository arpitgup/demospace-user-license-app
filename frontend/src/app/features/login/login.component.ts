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
    localStorage.clear();
    google.accounts.id.initialize({
      client_id:
        '385039775654-deso4nja1vond0f98j0p4vic6uvt91su.apps.googleusercontent.com',
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
      const decodedToken: any = jwtDecode(token);
      if (decodedToken) {
        localStorage.setItem('userEmail', decodedToken.email);
        localStorage.setItem('googleIdToken', token);
        console.log('///////', sessionStorage.getItem('googleIdToken'));
        this.router.navigate(['/admin']);
      }
    });
  }
}
