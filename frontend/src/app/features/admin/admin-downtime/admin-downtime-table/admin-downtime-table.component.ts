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
import { MatSort, MatSortModule, SortDirection } from '@angular/material/sort';
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
import {
  getLocalTimeZoneAbbreviation,
  isSameDay,
} from '../../../../../utilities/utils';

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

  // Template helpers
  readonly userValue = computed(
    () =>
      this.searchForm.controls[this.SEARCH_USER_FORM].value.trim().length > 0
  );
  readonly appValue = computed(
    () => this.searchForm.controls[this.SEARCH_APP_FORM].value.trim().length > 0
  );
  readonly dateValue = computed(
    () => this.searchForm.controls[this.SEARCH_DATE_FORM].value !== null
  );

  // Derived search criteria
  private readonly searchCriteria = signal<{
    searchUser: string;
    searchApplication: string;
    searchDate: Date | null;
  }>({ searchUser: '', searchApplication: '', searchDate: null });

  // Table bindings
  readonly dataSource = new MatTableDataSource<SelectableDowntime>([]);
  readonly displayedColumns = [
    'select',
    'dates',
    'createdBy',
    'apps',
    'reason',
    'status',
  ] as const;

  // MatSort/MatPaginator handling (re-attach on re-render under @if)
  private _sort!: MatSort;
  private _paginator!: MatPaginator;
  private _initialSortApplied = false;
  localTimeAbbrevation: string = '';

  @ViewChild(MatSort)
  set matSort(sort: MatSort) {
    if (!sort) return;
    this._sort = sort;
    this.dataSource.sort = sort;

    // Accessor for each column
    this.dataSource.sortingDataAccessor = (item, columnId) => {
      switch (columnId) {
        case 'dates':
          return new Date(item.downtime_start).getTime();
        case 'createdBy':
          return (item.created_by || '').toLowerCase();
        case 'reason':
          return (item.downtime_reason || '').toLowerCase();
        case 'status':
          return (item.status || '').toLowerCase();
        default:
          return '';
      }
    };

    // Stable, null-safe comparator
    this.dataSource.sortData = (data, matSort) => {
      const id = matSort.active;
      const dir = matSort.direction === 'asc' ? 1 : -1;
      if (!id || !matSort.direction) return data;

      const val = (d: SelectableDowntime) =>
        this.dataSource.sortingDataAccessor!(d, id);

      return [...data].sort((a, b) => {
        const va = val(a);
        const vb = val(b);
        const isNum = (v: unknown): v is number =>
          typeof v === 'number' && !Number.isNaN(v);

        if (va == null && vb == null) return 0;
        if (va == null) return -1 * dir;
        if (vb == null) return 1 * dir;

        if (isNum(va) && isNum(vb)) return (va - vb) * dir;
        return String(va).localeCompare(String(vb)) * dir;
      });
    };

    // One-time default sort: dates desc
    if (!this._initialSortApplied) {
      queueMicrotask(() => {
        this._sort.sort({ id: 'dates', start: 'desc', disableClear: true });
      });
      this._initialSortApplied = true;
    }
  }

  @ViewChild(MatPaginator)
  set matPaginator(p: MatPaginator) {
    if (!p) return;
    this._paginator = p;
    this.dataSource.paginator = p;
  }

  constructor() {
    // Keep table data in sync with filters
    effect(() => {
      const filtered = this.filteredDowntimes();
      this.dataSource.data = filtered;

      // Reset to first page on filter changes
      if (this._paginator && this._paginator.pageIndex !== 0) {
        this._paginator.firstPage();
      }

      // Selection state relative to visible rows
      const allVisibleSelected =
        filtered.length > 0 && filtered.every((d) => !!d.isSelected);
      const anyVisibleSelected = filtered.some((d) => !!d.isSelected);

      this.selectAll.set(allVisibleSelected);
      this.showCancelCta.set(anyVisibleSelected && !this.showPastDowntimes());
    });
  }

  ngOnInit(): void {
    this.getAllDowntimes();
    this.listenToSearchChanges();
    this.localTimeAbbrevation =
      getLocalTimeZoneAbbreviation(
        new Date(new Date()) ?? new Date(),
        Intl.DateTimeFormat().resolvedOptions().timeZone
      ) ?? '';
  }

  ngAfterViewInit(): void {
    // no-op; wiring done by setters
  }

  // Derived & filtered items
  private readonly filteredDowntimes = computed(() => {
    const all = this.allDowntimes();
    const showPast = this.showPastDowntimes();
    const { searchUser, searchApplication, searchDate } = this.searchCriteria();

    const statusSet = new Set(
      showPast ? ['COMPLETED', 'CANCELLED'] : ['PENDING', 'ACTIVE']
    );
    const user = searchUser.trim().toLowerCase();
    const app = searchApplication.trim().toLowerCase();

    return all
      .filter((item) => statusSet.has((item.status || '').toUpperCase()))
      .filter((item) => (item.created_by || '').toLowerCase().includes(user))
      .filter((item) =>
        (item.application?.name || '').toLowerCase().includes(app)
      )
      .filter((item) =>
        searchDate ? isSameDay(new Date(item.downtime_start), searchDate) : true
      );
  });

  /* ---------------- Data load ---------------- */
  getAllDowntimes(isInitialLoad = true): void {
    if (isInitialLoad) this.isLoading.set(true);

    this.downtimeService
      .listDowntimes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.allDowntimes.set(data.map((d) => ({ ...d, isSelected: false })));
          this.showCancelCta.set(false);
          this.selectAll.set(false);

          // Nudge current sort after dataset replacement
          if (this._sort?.active && this._sort.direction) {
            queueMicrotask(() => {
              this._sort.sort({
                id: this._sort.active,
                start: this._sort.direction as SortDirection,
                disableClear: true,
              });
            });
          }
        },
        error: (err: unknown) => {
          const message =
            (err as { error?: { detail?: string } })?.error?.detail ??
            'Could not load downtimes.';
          this.showErrorDialog(message);
        },
        complete: () => this.isLoading.set(false),
      });
  }

  /* ---------------- Filters ---------------- */
  private listenToSearchChanges(): void {
    this.searchForm.valueChanges
      .pipe(
        debounceTime(250),
        map((v) => ({
          searchUser: (v[this.SEARCH_USER_FORM] ?? '').toString(),
          searchApplication: (v[this.SEARCH_APP_FORM] ?? '').toString(),
          searchDate: (v[this.SEARCH_DATE_FORM] as Date | null) ?? null,
        })),
        distinctUntilChanged(
          (a, b) =>
            a.searchUser === b.searchUser &&
            a.searchApplication === b.searchApplication &&
            (a.searchDate?.toDateString() ?? '') ===
              (b.searchDate?.toDateString() ?? '')
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((criteria) => this.searchCriteria.set(criteria));
  }

  onRefreshCall(): void {
    this.searchForm.reset({
      [this.SEARCH_USER_FORM]: '',
      [this.SEARCH_APP_FORM]: '',
      [this.SEARCH_DATE_FORM]: null,
    });

    this.getAllDowntimes(false);
  }

  clearSearchField(
    fieldName:
      | typeof this.SEARCH_USER_FORM
      | typeof this.SEARCH_APP_FORM
      | typeof this.SEARCH_DATE_FORM
  ): void {
    // By checking the fieldName, we provide a type guard that allows
    // TypeScript to infer the correct control type in each block.
    if (fieldName === this.SEARCH_DATE_FORM) {
      // Within this block, TypeScript knows the control is FormControl<Date | null>.
      this.searchForm.controls[fieldName].setValue(null);
    } else {
      // Within this block, TypeScript knows the control is FormControl<string>.
      this.searchForm.controls[fieldName].setValue('');
    }
  }

  onShowPastChange(checked: boolean): void {
    this.showPastDowntimes.set(checked);
    this.selectAll.set(false);
    // Clear selections when switching view
    this.allDowntimes.update((list) =>
      list.map((d) => ({ ...d, isSelected: false }))
    );
  }

  /* ---------------- Selection ---------------- */
  onSelectAll(checked: boolean): void {
    const visibleIds = new Set(this.dataSource.data.map((d) => d.id));
    this.allDowntimes.update((downtimes) =>
      downtimes.map((d) =>
        visibleIds.has(d.id) ? { ...d, isSelected: checked } : d
      )
    );
  }

  onRowSelect(checked: boolean, downtimeId: number): void {
    this.allDowntimes.update((downtimes) =>
      downtimes.map((d) =>
        d.id === downtimeId ? { ...d, isSelected: checked } : d
      )
    );
  }

  trackById = (_: number, row: SelectableDowntime) => row.id;

  /* ---------------- Bulk cancel ---------------- */
  showCancelConfirmationDialog(): void {
    const selectedIds = this.allDowntimes()
      .filter((d) => d.isSelected)
      .map((d) => d.id);

    if (selectedIds.length === 0) return;

    const dialogRef = this.dialog.open(ConfirmationDialog, {
      data: {
        title: 'Are You Sure?',
        message: `Do you want to cancel the selected (${selectedIds.length}) downtimes?`,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        applications: '',
        licenseTitle: '',
        startDateTime:'',
        endDateTime:''

      },
    });

    dialogRef.afterClosed().subscribe((confirmed: unknown) => {
      if (confirmed) this.callBulkCancelDowntimes(selectedIds);
    });
  }

  private callBulkCancelDowntimes(ids: number[]): void {
    const payload: BulkCancelDowntimeRequest = { downtimeIds: ids };

    this.downtimeService.bulkCancelDowntimes(payload).subscribe({
      next: (response) => {
        if (response.failedToCancel.length > 0) {
          this.showErrorDialog(
            `Failed to cancel ${response.failedToCancel.length} downtime(s).`
          );
        }
        this.getAllDowntimes(false);
      },
      error: (err: unknown) => {
        const message =
          (err as { error?: { detail?: string } })?.error?.detail ??
          'An error occurred during cancellation.';
        this.showErrorDialog(message);
      },
    });
  }

  /* ---------------- Utilities ---------------- */
  private showErrorDialog(message: string): void {
    this.dialog.open(ErrorDialog, { data: { message } });
  }

  formatDate(dateTime: string) {
    return new Date(dateTime);
  }
}
