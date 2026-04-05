import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AfaqLogoComponent } from '../../shared/ui/afaq-logo/afaq-logo.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, AfaqLogoComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent {}
