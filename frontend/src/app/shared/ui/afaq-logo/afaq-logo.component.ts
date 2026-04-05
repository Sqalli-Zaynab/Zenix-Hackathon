import { Component, Input } from '@angular/core';

let afaqLogoId = 0;

@Component({
  selector: 'app-afaq-logo',
  standalone: true,
  templateUrl: './afaq-logo.component.html',
  styleUrls: ['./afaq-logo.component.css'],
})
export class AfaqLogoComponent {
  @Input() dark = false;

  readonly figureGradientId = `afaq-logo-figure-gradient-${afaqLogoId++}`;

  get wordmarkColor(): string {
    return this.dark ? '#ffffff' : '#534AB7';
  }

  get taglineColor(): string {
    return this.dark ? '#444441' : '#B4B2A9';
  }
}
