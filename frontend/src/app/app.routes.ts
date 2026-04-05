import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/landing-page.component').then(
        (module) => module.LandingPageComponent,
      ),
  },
  {
    path: 'input',
    loadComponent: () =>
      import('./pages/input-page.component').then(
        (module) => module.InputPageComponent,
      ),
  },
];
