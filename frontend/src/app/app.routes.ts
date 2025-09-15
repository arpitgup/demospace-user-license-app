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
    path: '**',
    redirectTo: '',
  },
];
