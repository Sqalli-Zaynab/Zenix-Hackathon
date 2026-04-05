import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/layout.component').then(
        (module) => module.LayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Afaq – AI Career Guidance',
        loadComponent: () =>
          import('./pages/landing-page.component').then(
            (module) => module.LandingPageComponent,
          ),
      },
      {
        path: 'input',
        title: 'Afaq – Profile',
        loadComponent: () =>
          import('./pages/input-page.component').then(
            (module) => module.InputPageComponent,
          ),
      },
      {
        path: 'results',
        title: 'Afaq – Results',
        loadComponent: () =>
          import('./pages/result-page.component').then(
            (module) => module.ResultPageComponent,
          ),
      },
    ],
  },
];
