import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import {
  BulkCancelDowntimeRequest,
  Downtime,
  DowntimeService,
} from '../../../../core/services/downtime.service';
import { TableLoaderComponent } from '../../../../loaders/table-loader/table-loader.component';
import { ConfirmationDialog } from '../../../../shared/dialogs/confirmation-dialog/confirmation-dialog';
import { ErrorDialog } from '../../../../shared/dialogs/error-dialog/error-dialog';
import { isSameDay } from '../../../../../utilities/utils';

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
    MatDatepickerModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './admin-downtime-table.component.html',
  styleUrl: './admin-downtime-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDowntimeTableComponent implements OnInit, AfterViewInit {
  private readonly downtimeService = inject(DowntimeService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(false);
  readonly showCancelCta = signal(false);
  readonly selectAll = signal(false);
  readonly showPastDowntimes = signal(false);
  private readonly allDowntimes = signal<SelectableDowntime[]>([]);
  readonly pageSizeOptions: number[] = [5];

  private readonly searchCriteria = signal({
    searchUser: '',
    searchApplication: '',
    searchDate: null as Date | null,
  });

  readonly dataSource = new MatTableDataSource<SelectableDowntime>([]);
  readonly displayedColumns: string[] = [
    'select', 'dates', 'createdBy', 'apps', 'reason', 'status'
  ];

  readonly SEARCH_USER_FORM = 'searchUser';
  readonly SEARCH_APP_FORM = 'searchApplication';
  readonly SEARCH_DATE_FORM = 'searchDate';
  readonly searchForm: FormGroup = this.fb.group({
    [this.SEARCH_USER_FORM]: [''],
    [this.SEARCH_APP_FORM]: [''],
    [this.SEARCH_DATE_FORM]: [''],
  });

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private readonly filteredDowntimes = computed(() => {
    const all = this.allDowntimes();
    const showPast = this.showPastDowntimes();
    const filters = this.searchCriteria();

    const activeStatuses = ['PENDING', 'ACTIVE'];
    const pastStatuses = ['COMPLETED', 'CANCELLED'];

    return all
      .filter(item =>
        (showPast ? pastStatuses : activeStatuses).includes(item.status.toUpperCase())
      )
      .filter(item =>
        item.created_by.toLowerCase().includes(filters.searchUser.toLowerCase())
      )
      .filter(item =>
        item.application.name.toLowerCase().includes(filters.searchApplication.toLowerCase())
      )
      .filter(item =>
        filters.searchDate ? isSameDay(new Date(item.downtime_start), filters.searchDate) : true
      );
  });

  constructor() {
    effect(() => {
      this.dataSource.data = this.filteredDowntimes();
    });
  }

  ngOnInit(): void {
    this.getAllDowntimes(true);
    this.listenToSearchChanges();
  }

  private listenToSearchChanges(): void {
    this.searchForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.searchCriteria.set({
          searchUser: value.searchUser || '',
          searchApplication: value.searchApplication || '',
          searchDate: value.searchDate || null,
        });
      });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'dates': return new Date(item.downtime_start).getTime();
        case 'createdBy': return item.created_by;
        case 'reason': return item.downtime_reason;
        default: {
          const value = item[property as keyof Downtime] as string | number;
          return typeof value === 'string' ? value.toLowerCase() : value;
        }
      }
    };
  }

  getAllDowntimes(isInitialLoad: boolean): void {
    if (isInitialLoad) this.isLoading.set(true);
    this.downtimeService.listDowntimes().subscribe({
      next: (data) => {
        this.allDowntimes.set(data.map((d) => ({ ...d, isSelected: false })));
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
    this.searchForm.reset({ searchUser: '', searchApplication: '', searchDate: null });
  }

  onShowPastChange(checked: boolean): void {
    this.showPastDowntimes.set(checked);
    this.selectAll.set(false);
  }

  onSelectAll(checked: boolean): void {
    this.selectAll.set(checked);
    const visibleIds = new Set(this.dataSource.data.map(d => d.id));
    this.allDowntimes.update(downtimes =>
      downtimes.map(d => visibleIds.has(d.id) ? { ...d, isSelected: checked } : d)
    );
    this.updateShowCancelCta(checked);
  }

  onRowSelect(checked: boolean, downtimeId: number): void {
    this.allDowntimes.update(downtimes =>
      downtimes.map(d => d.id === downtimeId ? { ...d, isSelected: checked } : d)
    );
    const isAnySelected = this.allDowntimes().some((item) => item.isSelected);
    this.updateShowCancelCta(isAnySelected);
    if (!isAnySelected) {
      this.selectAll.set(false);
    }
  }

  updateShowCancelCta(value: boolean): void {
    this.showCancelCta.set(value);
  }

  showCancelConfirmationDialog(): void {
    const selectedIds = this.allDowntimes().filter(d => d.isSelected).map(d => d.id);
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
      if (result) this.callBulkCancelDowntimes(selectedIds);
    });
  }

  callBulkCancelDowntimes(ids: number[]): void {
    const payload: BulkCancelDowntimeRequest = { downtimeIds: ids };
    this.downtimeService.bulkCancelDowntimes(payload).subscribe({
      next: (response) => {
        if (response.failedToCancel.length > 0) {
          this.showErrorDialog(`Failed to cancel ${response.failedToCancel.length} downtime(s).`);
        }
        this.getAllDowntimes(false);
      },
      error: (err) => this.showErrorDialog(err?.error?.detail || 'An error occurred during cancellation.'),
    });
  }

  showErrorDialog(message: string): void {
    this.dialog.open(ErrorDialog, { data: { message } });
  }
}

