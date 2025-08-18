import {
  Component,
  signal,
  ChangeDetectionStrategy,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { FooterComponent } from './shared/components/footer/footer.component';
import { HeaderComponent } from './shared/components/header/ header.component';
import { CommonLoader } from './shared/components/loaders/common-loader/common-loader';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, CommonLoader],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  protected readonly title = signal('agentspace-reservations');
  readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      this.route.queryParams.subscribe((params) => {
        const userEmail = params['userEmail'] || null;

        if (userEmail) {
          sessionStorage.setItem('userEmail', userEmail);
        }
      });
    }
  }
}
