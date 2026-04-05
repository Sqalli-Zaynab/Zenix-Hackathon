import { Component } from '@angular/core';

import { CtaSectionComponent } from '../components/cta-section/cta-section.component';
import { FeaturesComponent } from '../components/features/features.component';
import { HeroComponent } from '../components/hero/hero.component';
import { HowItWorksComponent } from '../components/how-it-works/how-it-works.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    HeroComponent,
    HowItWorksComponent,
    FeaturesComponent,
    CtaSectionComponent,
  ],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css'],
})
export class LandingPageComponent {}
