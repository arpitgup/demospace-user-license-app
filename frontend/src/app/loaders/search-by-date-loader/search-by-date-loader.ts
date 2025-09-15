import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatGridListModule } from '@angular/material/grid-list';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  selector: 'app-search-by-date-loader',
  imports: [
    NgxSkeletonLoaderModule,
    MatGridListModule,
    MatCardModule,
    MatDividerModule,
  ],
  templateUrl: './search-by-date-loader.html',
  styleUrl: './search-by-date-loader.scss',
})
export class SearchByApplicationLoader {}
