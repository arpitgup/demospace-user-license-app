import {
  AfterViewInit,
  Component,
  inject,
  NgZone,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';

import { jwtDecode } from 'jwt-decode';

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

  ngOnInit(): void {
    // Initialize the Google client with your Client ID and a callback function
    if (typeof google === 'undefined') {
      return;
    }
    localStorage.clear();
    google.accounts.id.initialize({
      client_id:
        '385039775654-deso4nja1vond0f98j0p4vic6uvt91su.apps.googleusercontent.com', // ⚠️ Replace with your actual Client ID
      callback: (response: any) => this.handleCredentialResponse(response),
    });

    // Render the Google Sign-In button
    google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      { theme: 'outline', size: 'large' }
    );
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
