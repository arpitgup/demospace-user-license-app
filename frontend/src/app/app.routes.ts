import { Routes } from '@angular/router';
import { NewUserGuard } from './guards/new-user.guard';
import { AdminGuard } from './guards/admin.guard';
import { EmailGuard } from './guards/email-guard.guard';

export const appRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
    canActivate: [EmailGuard],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin-home/admin-home.component').then(
        (m) => m.AdminHomeComponent
      ),
    canActivate: [AdminGuard],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
    canActivate: [AdminGuard],
  },

  {
    path: 'welcome',
    loadComponent: () =>
      import('./features/welcome/welcome.component').then(
        (m) => m.WelcomeComponent
      ),
    canActivate: [NewUserGuard],
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/signup-user/signup-user.component').then(
        (m) => m.SignupUserComponent
      ),
    canActivate: [NewUserGuard],
  },
  {
    path: 'license-reservation',
    loadComponent: () =>
      import('./features/landing/landing.page').then((m) => m.LandingPage),
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./loaders/home-loader/home-loader.component').then(
        (m) => m.HomeLoaderComponent
      ),
  },
  {
    path: 'how-to-login',
    loadComponent: () =>
      import('./features/how-to-login/how-to-login.component').then(
        (m) => m.HowToLoginComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
