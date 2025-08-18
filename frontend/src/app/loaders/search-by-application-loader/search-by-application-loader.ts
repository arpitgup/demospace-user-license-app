import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatGridListModule } from '@angular/material/grid-list';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  selector: 'app-search-by-application-loader',
  imports: [
    NgxSkeletonLoaderModule,
    MatGridListModule,
    MatCardModule,
    MatDividerModule,
  ],
  templateUrl: './search-by-application-loader.html',
  styleUrl: './search-by-application-loader.scss',
})
export class SearchByApplicationLoader {}
