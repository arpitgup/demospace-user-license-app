import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  selector: 'app-search-option-content-loader',
  imports: [NgxSkeletonLoaderModule, MatCardModule],
  templateUrl: './search-option-content-loader.html',
  styleUrl: './search-option-content-loader.scss',
})
export class SearchOptionContentLoader {}
