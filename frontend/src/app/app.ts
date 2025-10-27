import {
  Component,
  signal,
  ChangeDetectionStrategy,
  inject,
  OnInit,
} from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  RouterOutlet,
  Router,
} from '@angular/router';
import { FooterComponent } from './shared/components/footer/footer.component';
import { HeaderComponent } from './shared/components/header/ header.component';
import { CommonLoader } from './shared/components/loaders/common-loader/common-loader';
import { AppTag } from './shared/components/app-tag/app-tag';
import { filter } from 'rxjs';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    CommonLoader,
    AppTag,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  protected readonly title = signal('agentspace-reservations');
  readonly route = inject(ActivatedRoute);
  showHeaderFooter: boolean = true;
  private router = inject(Router);

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = event.url;
        this.showHeaderFooter = (!url.includes('/login')&&!url.includes('/signup') && !url.includes('/welcome'));
      });
  }
  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      // sessionStorage.clear();
      this.route.queryParams.subscribe((params) => {
        if (params) {
          const userEmail = params['userEmail'] || null;
          if (userEmail) {
            sessionStorage.setItem('userEmail', userEmail);
          }
        }
      });
    }
  }
}
