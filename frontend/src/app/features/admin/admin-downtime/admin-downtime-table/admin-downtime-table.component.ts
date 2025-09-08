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
    MatDatepickerModule,
    MatButtonModule,
    TableLoaderComponent,
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
  readonly pageSizeOptions: number[] = [5, 10, 25, 50];
  readonly NO_DOWNTIMES_MSG = 'No downtimes match the current filters.';
  private readonly allDowntimes = signal<SelectableDowntime[]>([]);

  readonly SEARCH_USER_FORM = 'searchUser';
  readonly SEARCH_APP_FORM = 'searchApplication';
  readonly SEARCH_DATE_FORM = 'searchDate';
  readonly searchForm: FormGroup = this.fb.group({
    [this.SEARCH_USER_FORM]: [''],
    [this.SEARCH_APP_FORM]: [''],
    [this.SEARCH_DATE_FORM]: [null],
  });

  private readonly searchCriteria = signal({
    searchUser: '',
    searchApplication: '',
    searchDate: null as Date | null,
  });

  readonly dataSource = new MatTableDataSource<SelectableDowntime>([]);
  readonly displayedColumns: string[] = [
    'select',
    'dates',
    'createdBy',
    'apps',
    'reason',
    'status',
  ];

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private readonly filteredDowntimes = computed(() => {
    const all = this.allDowntimes();
    const showPast = this.showPastDowntimes();
    const { searchUser, searchApplication, searchDate } = this.searchCriteria();
    const activeStatuses = ['PENDING', 'ACTIVE'];
    const pastStatuses = ['COMPLETED', 'CANCELLED'];

    return all
      .filter((item) =>
        (showPast ? pastStatuses : activeStatuses).includes(
          (item.status || '').toUpperCase()
        )
      )
      .filter((item) =>
        (item.created_by || '')
          .toLowerCase()
          .includes((searchUser || '').toLowerCase())
      )
      .filter((item) =>
        (item.application?.name || '')
          .toLowerCase()
          .includes((searchApplication || '').toLowerCase())
      )
      .filter((item) =>
        searchDate ? isSameDay(new Date(item.downtime_start), searchDate) : true
      );
  });

  constructor() {
    effect(() => {
      this.dataSource.data = this.filteredDowntimes();
      const visible = this.dataSource.data;
      const allVisibleSelected =
        visible.length > 0 && visible.every((d) => d.isSelected);
      this.selectAll.set(allVisibleSelected);
      this.updateShowCancelCta(visible.some((d) => d.isSelected));
    });
  }

  ngOnInit(): void {
    this.getAllDowntimes(true);
    this.listenToSearchChanges();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;


    this.dataSource.sortingDataAccessor = (item, property) => {
      console.log({ item, property })
      switch (property) {
        case 'dates':
          return new Date(item.downtime_start).getTime();
        case 'createdBy':
          return item.created_by;
        case 'reason':
          return item.downtime_reason;
        case 'status':
          return item.status;
        default:
          const value = item[property as keyof Downtime];
          return typeof value === 'string' || typeof value === 'number'
            ? value
            : String(value);
      }
    };
  }

  getAllDowntimes(isInitialLoad: boolean): void {
    if (isInitialLoad) this.isLoading.set(true);
    this.downtimeService.listDowntimes().subscribe({
      next: (data) => {
        this.allDowntimes.set(data.map((d) => ({ ...d, isSelected: false })));
        if (isInitialLoad) this.isLoading.set(false);
      },
      error: (err) => {
        if (isInitialLoad) this.isLoading.set(false);
        this.showErrorDialog(err?.error?.detail || 'Could not load downtimes.');
      },
    });
  }

  private listenToSearchChanges(): void {
    this.searchForm.valueChanges
      .pipe(
        map((v) => ({
          searchUser: (v[this.SEARCH_USER_FORM] || '').toString().trim(),
          searchApplication: (v[this.SEARCH_APP_FORM] || '').toString().trim(),
          searchDate: v[this.SEARCH_DATE_FORM] || null,
        })),
        distinctUntilChanged(
          (a, b) =>
            a.searchUser === b.searchUser &&
            a.searchApplication === b.searchApplication &&
            (a.searchDate?.getTime() || 0) === (b.searchDate?.getTime() || 0)
        ),
        debounceTime(250),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((value) => this.searchCriteria.set(value));
  }

  onRefreshCall(): void {
    this.searchForm.reset({
      [this.SEARCH_USER_FORM]: '',
      [this.SEARCH_APP_FORM]: '',
      [this.SEARCH_DATE_FORM]: null,
    });
    this.getAllDowntimes(true);
  }

  clearSearchField(fieldName: string): void {
    const isDate = fieldName === this.SEARCH_DATE_FORM;
    this.searchForm.get(fieldName)?.setValue(isDate ? null : '');
  }

  onShowPastChange(checked: boolean): void {
    this.showPastDowntimes.set(checked);
    this.allDowntimes.update((list) =>
      list.map((d) => ({ ...d, isSelected: false }))
    );
  }

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

  updateShowCancelCta(value: boolean): void {
    this.showCancelCta.set(value);
  }

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
