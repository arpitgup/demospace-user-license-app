import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatGridListModule } from '@angular/material/grid-list';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  selector: 'app-reservation-table-loader',
  imports: [
    NgxSkeletonLoaderModule,
    MatGridListModule,
    MatCardModule,
    MatDividerModule,
  ],
  templateUrl: './reservation-table-loader.html',
  styleUrl: './reservation-table-loader.scss',
})
export class ReservationTableLoader {}
