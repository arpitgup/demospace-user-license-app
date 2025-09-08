import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import {
  BulkCancelDowntimeRequest,
  Downtime,
  DowntimeService,
} from '../../../../core/services/downtime.service';
import { TableLoaderComponent } from '../../../../loaders/table-loader/table-loader.component';
import { ConfirmationDialog } from '../../../../shared/dialogs/confirmation-dialog/confirmation-dialog';
import { ErrorDialog } from '../../../../shared/dialogs/error-dialog/error-dialog';

type SelectableDowntime = Downtime & { isSelected?: boolean };

@Component({
  selector: 'app-admin-downtime-table',
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatCheckboxModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    TableLoaderComponent,
  ],
  templateUrl: './admin-downtime-table.component.html',
  styleUrl: './admin-downtime-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDowntimeTableComponent implements OnInit, AfterViewInit {
  private readonly downtimeService = inject(DowntimeService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly isLoading = signal(false);
  readonly showCancelCta = signal(false);
  readonly selectAll = signal(false);
  private readonly isRefreshCall = signal(false);

  readonly dataSource = new MatTableDataSource<SelectableDowntime>([]);
  readonly displayedColumns: string[] = [
    'select',
    'dates',
    'createdBy',
    'apps',
    'reason',
    'status',
  ];

  readonly SEARCH_APP_FORM = 'searchApplication';
  readonly searchForm: FormGroup = this.fb.group({
    [this.SEARCH_APP_FORM]: [''],
  });

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit(): void {
    this.getAllDowntimes(true);
    this.listenFormChanges();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'dates':
          return new Date(item.downtime_start).getTime();
        case 'createdBy':
          return item.created_by;
        case 'reason':
          return item.downtime_reason;
        default: {
          const value = item[property as keyof Downtime] as string | number;
          return typeof value === 'string' ? value.toLowerCase() : value;
        }
      }
    };
  }

  listenFormChanges(): void {
    this.searchForm
      .get(this.SEARCH_APP_FORM)
      ?.valueChanges.subscribe((value: string) => {
        if (this.isRefreshCall()) return;
        this.dataSource.filterPredicate = (data, filter) => {
          return data.application.name.toLowerCase().includes(filter);
        };
        this.dataSource.filter = value.trim().toLowerCase();
      });
  }

  getAllDowntimes(isInitialLoad: boolean): void {
    if (isInitialLoad) this.isLoading.set(true);

    this.downtimeService.listDowntimes().subscribe({
      next: (data) => {
        this.dataSource.data = data.map((d) => ({ ...d, isSelected: false }));
        this.updateShowCancelCta(false);
        this.selectAll.set(false);
        if (isInitialLoad) this.isLoading.set(false);
      },
      error: (err) => {
        if (isInitialLoad) this.isLoading.set(false);
        this.showErrorDialog(err?.error?.detail || 'Could not load downtimes.');
      },
    });
  }

  onRefreshCall(): void {
    this.isRefreshCall.set(true);
    this.searchForm.get(this.SEARCH_APP_FORM)?.patchValue('');
    this.isRefreshCall.set(false);
    this.getAllDowntimes(true);
  }

  onSelectAll(checked: boolean): void {
    this.selectAll.set(checked);
    this.dataSource.data = this.dataSource.data.map((item) => ({
      ...item,
      isSelected: checked,
    }));
    this.updateShowCancelCta(checked);
  }

  onRowSelect(checked: boolean, downtimeId: number): void {
    this.dataSource.data = this.dataSource.data.map((item) => {
      if (item.id === downtimeId) return { ...item, isSelected: checked };
      return item;
    });

    const isAnySelected = this.dataSource.data.some((item) => item.isSelected);
    this.updateShowCancelCta(isAnySelected);
    this.selectAll.set(
      isAnySelected && this.dataSource.data.every((item) => item.isSelected)
    );
  }

  updateShowCancelCta(value: boolean): void {
    this.showCancelCta.set(value);
  }

  showCancelConfirmationDialog(): void {
    const selectedIds = this.dataSource.data
      .filter((item) => item.isSelected)
      .map((item) => item.id);

    if (selectedIds.length === 0) return;

    const dialogRef = this.dialog.open(ConfirmationDialog, {
      data: {
        title: 'Are You Sure?',
        message: `Do you want to cancel the selected (${selectedIds.length}) downtimes?`,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.callBulkCancelDowntimes(selectedIds);
      }
    });
  }

  callBulkCancelDowntimes(ids: number[]): void {
    const payload: BulkCancelDowntimeRequest = {
      downtimeIds: ids,
    };

    this.downtimeService.bulkCancelDowntimes(payload).subscribe({
      next: (response) => {
        if (response.failedToCancel.length > 0) {
          this.showErrorDialog(
            `Failed to cancel ${response.failedToCancel.length} downtime(s).`
          );
        }
        this.getAllDowntimes(false);
      },
      error: (err) => {
        this.showErrorDialog(
          err?.error?.detail || 'An error occurred during cancellation.'
        );
      },
    });
  }

  showErrorDialog(message: string): void {
    this.dialog.open(ErrorDialog, { data: { message } });
  }
}
