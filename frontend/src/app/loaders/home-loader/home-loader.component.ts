import { Component } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  selector: 'app-home-loader',
  imports: [
    MatSidenavModule,
    NgxSkeletonLoaderModule
  ],
  templateUrl: './home-loader.component.html',
  styleUrl: './home-loader.component.scss'
})
export class HomeLoaderComponent {

}
