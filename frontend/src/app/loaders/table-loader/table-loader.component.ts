import { Component } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  selector: 'app-table-loader',
  imports: [NgxSkeletonLoaderModule,MatTableModule],
  templateUrl: './table-loader.component.html',
  styleUrl: './table-loader.component.scss',
})
export class TableLoaderComponent {
  displayedColumns: string[] = [
    'select',
    'reservationDate',
    'reservedBy',
    'applications',
    'status',
    'action',
  ];

  dataSource = new MatTableDataSource<MOCK_ELEMNT>(ELEMENT_DATA);
}

export interface MOCK_ELEMNT {
  select: string;
  reservationDate: string;
  reservedBy: string;
  applications: string;
  status: string;
  action: string;
}

const ELEMENT_DATA: MOCK_ELEMNT[] = [
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
  {
    select: '1',
    reservationDate: '',
    reservedBy: '',
    applications: '',
    status: '',
    action: '',
  },
];
