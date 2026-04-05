import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AfaqLogoComponent } from '../../shared/ui/afaq-logo/afaq-logo.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [AfaqLogoComponent, RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
})
export class FooterComponent {}
