import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe, NgOptimizedImage } from '@angular/common';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';

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
import { MatButtonModule } from '@angular/material/button';

import {
  BulkCancelDowntimeRequest,
  Downtime,
  DowntimeService,
} from '../../../../core/services/downtime.service';
import { TableLoaderComponent } from '../../../../loaders/table-loader/table-loader.component';
import { ConfirmationDialog } from '../../../../shared/dialogs/confirmation-dialog/confirmation-dialog';
import { ErrorDialog } from '../../../../shared/dialogs/error-dialog/error-dialog';
import { isSameDay } from '../../../../../utilities/utils';

import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

type SelectableDowntime = Downtime & { isSelected?: boolean };

type SearchFormShape = {
  searchUser: FormControl<string>;
  searchApplication: FormControl<string>;
  searchDate: FormControl<Date | null>;
};

@Component({
  selector: 'app-admin-downtime-table',
  imports: [
    CommonModule,
    DatePipe,
    NgOptimizedImage,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatCheckboxModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    TableLoaderComponent,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './admin-downtime-table.component.html',
  styleUrl: './admin-downtime-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'admin-downtime-table' },
})
export class AdminDowntimeTableComponent implements OnInit, AfterViewInit {
  private readonly downtimeService = inject(DowntimeService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  // UI state
  readonly isLoading = signal(true);
  readonly showCancelCta = signal(false);
  readonly selectAll = signal(false);
  readonly showPastDowntimes = signal(false);

  // Data state
  readonly pageSizeOptions: number[] = [5, 10, 25, 50];
  readonly NO_DOWNTIMES_MSG = 'No downtimes match the current filters.';
  private readonly allDowntimes = signal<SelectableDowntime[]>([]);

  // Form constants
  readonly SEARCH_USER_FORM = 'searchUser' as const;
  readonly SEARCH_APP_FORM = 'searchApplication' as const;
  readonly SEARCH_DATE_FORM = 'searchDate' as const;

  // Strongly-typed reactive form
  readonly searchForm: FormGroup<SearchFormShape> = this.fb.group({
    [this.SEARCH_USER_FORM]: this.fb.nonNullable.control<string>(''),
    [this.SEARCH_APP_FORM]: this.fb.nonNullable.control<string>(''),
    [this.SEARCH_DATE_FORM]: this.fb.control<Date | null>(null),
  });

  // Derived search criteria
  private readonly searchCriteria = signal({
    searchUser: '',
    searchApplication: '',
    searchDate: null as Date | null,
  });

  // Table bindings
  readonly dataSource = new MatTableDataSource<SelectableDowntime>([]);
  readonly displayedColumns = [
    'select', 'dates', 'createdBy', 'apps', 'reason', 'status',
  ] as const;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // Quick read helpers for template conditions
  readonly userValue = computed(() => this.searchForm.controls.searchUser.value.trim().length > 0);
  readonly appValue = computed(() => this.searchForm.controls.searchApplication.value.trim().length > 0);
  readonly dateValue = computed(() => this.searchForm.controls.searchDate.value !== null);

  // Derived list (filters + status group)
  private readonly filteredDowntimes = computed(() => {
    const all = this.allDowntimes();
    const showPast = this.showPastDowntimes();
    const { searchUser, searchApplication, searchDate } = this.searchCriteria();
    const statusSet = new Set(showPast ? ['COMPLETED', 'CANCELLED'] : ['PENDING', 'ACTIVE']);
    const user = searchUser.trim().toLowerCase();
    const app = searchApplication.trim().toLowerCase();

    return all.filter(
      (item) =>
        statusSet.has((item.status || '').toUpperCase()) &&
        (item.created_by || '').toLowerCase().includes(user) &&
        (item.application?.name || '').toLowerCase().includes(app) &&
        (searchDate ? isSameDay(new Date(item.downtime_start), searchDate) : true)
    );
  });

  constructor() {
    effect(() => {
      const filtered = this.filteredDowntimes();
      this.dataSource.data = filtered;
      if (this.paginator) {
        this.paginator.firstPage();
      }
      const allVisibleSelected = filtered.length > 0 && filtered.every((d) => d.isSelected);
      const anyVisibleSelected = filtered.some((d) => d.isSelected);
      this.selectAll.set(allVisibleSelected);
      this.showCancelCta.set(anyVisibleSelected && !this.showPastDowntimes());
    });
  }

  ngOnInit(): void {
    this.getAllDowntimes();
    this.listenToSearchChanges();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item, columnId): string | number => {
      switch (columnId) {
        case 'dates': return new Date(item.downtime_start).getTime();
        case 'createdBy': return (item.created_by || '').toLowerCase();
        case 'reason': return (item.downtime_reason || '').toLowerCase();
        case 'status': return (item.status || '').toLowerCase();
        default: return '';
      }
    };
  }

  getAllDowntimes(isInitialLoad = true): void {
    if (isInitialLoad) this.isLoading.set(true);
    this.downtimeService.listDowntimes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.allDowntimes.set(data.map((d) => ({ ...d, isSelected: false })));
        this.showCancelCta.set(false);
        this.selectAll.set(false);
      },
      error: (err) => this.showErrorDialog((err as any)?.error?.detail ?? 'Could not load downtimes.'),
      complete: () => this.isLoading.set(false),
    });
  }

  private listenToSearchChanges(): void {
    this.searchForm.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      map((value) => ({
        searchUser: value.searchUser ?? '',
        searchApplication: value.searchApplication ?? '',
        searchDate: value.searchDate ?? null,
      })),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((criteria) => this.searchCriteria.set(criteria));
  }

  onRefreshCall(): void {
    this.searchForm.reset({
      searchUser: '',
      searchApplication: '',
      searchDate: null,
    });
    this.getAllDowntimes(false);
  }

  clearSearchField(fieldName: keyof SearchFormShape): void {
    const control = this.searchForm.get(fieldName);
    if (control) {
        control.setValue(fieldName === this.SEARCH_DATE_FORM ? null : '');
    }
  }

  onShowPastChange(checked: boolean): void {
    this.showPastDowntimes.set(checked);
    this.selectAll.set(false);
    this.allDowntimes.update((list) => list.map((d) => ({ ...d, isSelected: false })));
  }

  onSelectAll(checked: boolean): void {
    const visibleIds = new Set(this.dataSource.data.map((d) => d.id));
    this.allDowntimes.update((downtimes) =>
      downtimes.map((d) => (visibleIds.has(d.id) ? { ...d, isSelected: checked } : d))
    );
  }

  onRowSelect(checked: boolean, downtimeId: number): void {
    this.allDowntimes.update((downtimes) =>
      downtimes.map((d) => (d.id === downtimeId ? { ...d, isSelected: checked } : d))
    );
  }

  showCancelConfirmationDialog(): void {
    const selectedIds = this.allDowntimes().filter((d) => d.isSelected).map((d) => d.id);
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

  private callBulkCancelDowntimes(ids: number[]): void {
    const payload: BulkCancelDowntimeRequest = { downtimeIds: ids };
    this.downtimeService.bulkCancelDowntimes(payload).subscribe({
      next: (response) => {
        if (response.failedToCancel.length > 0) {
          this.showErrorDialog(`Failed to cancel ${response.failedToCancel.length} downtime(s).`);
        }
        this.getAllDowntimes(false);
      },
      error: (err) => this.showErrorDialog((err as any)?.error?.detail ?? 'An error occurred during cancellation.'),
    });
  }

  private showErrorDialog(message: string): void {
    this.dialog.open(ErrorDialog, { data: { message } });
  }
  
  trackById = (_: number, row: SelectableDowntime) => row.id;
}

