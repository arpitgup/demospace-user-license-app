import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.page').then((m) => m.LandingPage),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin-home/admin-home.component').then(
        (m) => m.AdminHomeComponent
      ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'details',
    loadComponent: () =>
      import('./features/user-details/user-details.component').then(
        (m) => m.UserDetailsComponent
      ),
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./features/welcome/welcome.component').then(
        (m) => m.WelcomeComponent
      ),
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/signup-user/signup-user.component').then(
        (m) => m.SignupUserComponent
      ),
  },
    {
    path: 'appLinks',
    loadComponent: () =>
      import('./features/user-app-links/user-app-links.component').then(
        (m) => m.UserAppLinksComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
