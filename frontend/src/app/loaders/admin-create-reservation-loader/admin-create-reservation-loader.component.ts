import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatGridListModule } from '@angular/material/grid-list';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  selector: 'app-admin-create-reservation-loader',
  imports: [
    NgxSkeletonLoaderModule,
    MatGridListModule,
    MatCardModule,
    MatDividerModule,
  ],
  templateUrl: './admin-create-reservation-loader.component.html',
  styleUrl: './admin-create-reservation-loader.component.scss',
})
export class AdminCreateReservationLoaderComponent {}
