import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from './shared/components/footer/footer.component';
import { HeaderComponent } from './shared/components/header/ header.component';
import { CommonLoader } from './shared/components/common-loader/common-loader/common-loader';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent,CommonLoader],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('agentspace-reservations');
}
