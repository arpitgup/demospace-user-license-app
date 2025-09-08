import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { provideNativeDateAdapter } from '@angular/material/core';

import {
  DowntimeService,
  ScheduleDowntimeRequest,
} from '../../../core/services/downtime.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { Application } from '../../../core/models/application.model';
import { MIN_DOWNTIME_HOURS } from './min-downtime.token';
import { ADMIN_DOWNTIME_CONSTANTS } from './admin-downtime.constants';
import { AdminDowntimeTableComponent } from './admin-downtime-table/admin-downtime-table.component';

type DowntimeReason = string;

@Component({
  selector: 'app-admin-downtime',
  imports: [
    CommonModule,
    MatTabsModule,
    AdminDowntimeTableComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule, // still used for Start/End Time selects
    MatDatepickerModule,
    MatButtonModule,
    MatChipsModule, // NEW
    MatIconModule, // NEW (chip remove icon)
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './admin-downtime.component.html',
  styleUrl: './admin-downtime.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    ngSkipHydration: 'true',
  },
})
export class AdminDowntimeComponent {
  private readonly fb = inject(FormBuilder);
  private readonly downtimeService = inject(DowntimeService);
  private readonly reservationService = inject(ReservationService);

  @ViewChild(AdminDowntimeTableComponent)
  private downtimeTable!: AdminDowntimeTableComponent;

  readonly constants = ADMIN_DOWNTIME_CONSTANTS;
  readonly minHours = MIN_DOWNTIME_HOURS;

  // UI state
  readonly isSubmitting = signal(false);

  // Data
  readonly apps = signal<Application[]>([]);
  private readonly appMap = computed<Map<number, Application>>(
    () => new Map(this.apps().map((a) => [a.id, a]))
  );

  readonly reasons = signal<DowntimeReason[]>([
    'Maintenance',
    'Version Update',
    'Security Patch',
    'Planned Outage',
    'Other',
  ]);

  // Hours [0..23]
  readonly HOURS = Array.from({ length: 24 }, (_, h) => h);

  // Form model
  readonly form = this.fb.group(
    {
      applications: this.fb.control<number[]>([], {
        nonNullable: true,
        validators: [Validators.required],
      }),
      startDate: this.fb.control<Date | null>(null, {
        validators: [Validators.required],
      }),
      startTime: this.fb.control<number | null>(null, {
        validators: [Validators.required],
      }),
      endDate: this.fb.control<Date | null>(null, {
        validators: [Validators.required],
      }),
      endTime: this.fb.control<number | null>(null, {
        validators: [Validators.required],
      }),
      reason: this.fb.control<DowntimeReason | null>(null, {
        validators: [Validators.required],
      }),
    },
    { validators: [rangeValidator(() => this.minHours)] }
  );

  // --- New: pill-based application selection state ---
  readonly selectedIds = signal<number[]>([]);
  readonly appQuery = signal<string>('');

  // Keep selectedIds in sync with the form control
  private readonly syncEffect = effect(() => {
    const formVal = this.form.controls.applications.value ?? [];
    if (JSON.stringify(formVal) !== JSON.stringify(this.selectedIds())) {
      this.selectedIds.set([...formVal]);
    }
  });

  readonly filteredApps = computed(() => {
    const q = this.appQuery().toLowerCase();
    const ids = new Set(this.selectedIds());
    return this.apps()
      .filter(
        (a) => (q ? a.name.toLowerCase().includes(q) : true)
        // show all apps; selected ones will be greyed/disabled in UI
      )
      .sort((a, b) => {
        // sort: selected last (grey), then alpha
        const aSel = ids.has(a.id) ? 1 : 0;
        const bSel = ids.has(b.id) ? 1 : 0;
        return aSel - bSel || a.name.localeCompare(b.name);
      });
  });

  // End-hour options depend on selected dates/times & minHours
  readonly endHourOptions = computed<number[]>(() => {
    const sDate = this.form.controls.startDate.value;
    const sHour = this.form.controls.startTime.value;
    const eDate = this.form.controls.endDate.value;

    if (!sDate || sHour == null || !eDate) return this.HOURS;
    if (!isSameYMD(sDate, eDate)) return this.HOURS;

    return this.HOURS.filter((h) => h >= sHour + this.minHours);
  });

  // Datepicker filters
  readonly startDateFilter = (d: Date | null): boolean => {
    if (!d) return false;
    const today = startOfDay(new Date());
    return startOfDay(d) >= today;
  };

  readonly endDateFilter = (d: Date | null): boolean => {
    if (!d) return false;
    const sDate = this.form.controls.startDate.value;
    if (!sDate) {
      const today = startOfDay(new Date());
      return startOfDay(d) >= today;
    }
    return startOfDay(d) >= startOfDay(sDate);
  };

  constructor() {
    // Load apps once
    this.reservationService
      .getApplications()
      .subscribe((fetchedApps) => this.apps.set(fetchedApps));

    // Auto-correct end when user picks a combo that violates min duration.
    effect(() => {
      const sDate = this.form.controls.startDate.value;
      const sHour = this.form.controls.startTime.value;
      const eDate = this.form.controls.endDate.value;
      const eHour = this.form.controls.endTime.value;

      if (sDate != null && sHour != null) {
        const minEnd = addHours(startOfHour(sDate, sHour), this.minHours);

        const endMissing = !eDate || eHour == null;
        const endTooEarly =
          !endMissing && startOfHour(eDate as Date, eHour as number) < minEnd;

        if (endMissing || endTooEarly) {
          this.form.patchValue(
            { endDate: minEnd, endTime: minEnd.getHours() },
            { emitEvent: false }
          );
        }
      }
    });
  }

  /* ---------- App pill interactions ---------- */

  onAppQuery(q: string): void {
    this.appQuery.set(q);
  }

  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  addApp(app: Application): void {
    if (this.isSelected(app.id)) return;
    const next = [...this.selectedIds(), app.id];
    this.selectedIds.set(next);
    this.form.controls.applications.setValue(next);
    this.form.controls.applications.markAsDirty();
    this.form.controls.applications.markAsTouched();
  }

  removeApp(id: number): void {
    const next = this.selectedIds().filter((x) => x !== id);
    this.selectedIds.set(next);
    this.form.controls.applications.setValue(next);
    this.form.controls.applications.markAsDirty();
    this.form.controls.applications.markAsTouched();
  }

  selectFirstMatch(): void {
    const first = this.filteredApps().find((a) => !this.isSelected(a.id));
    if (first) this.addApp(first);
  }

  appById(id: number): Application | undefined {
    return this.appMap().get(id);
  }

  /* ---------- Template hooks for dates/times ---------- */

  onStartDateChanged(): void {
    const sDate = this.form.controls.startDate.value;
    const eDate = this.form.controls.endDate.value;
    if (sDate && eDate && startOfDay(eDate) < startOfDay(sDate)) {
      this.form.patchValue({ endDate: sDate }, { emitEvent: false });
    }
  }

  onEndDateChanged(): void {}
  onStartTimeChanged(): void {}

  /* ---------- Form actions ---------- */

  resetForm(): void {
    this.form.reset();
    this.form.controls.applications.setValue([]);
    this.selectedIds.set([]);
    this.appQuery.set('');
    this.isSubmitting.set(false);
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);

    const v = this.form.getRawValue();
    const start = startOfHour(v.startDate!, v.startTime!);
    const end = startOfHour(v.endDate!, v.endTime!);

    const payload: ScheduleDowntimeRequest = {
      applications: v.applications!,
      downtimeStart: start.toISOString(),
      downtimeEnd: end.toISOString(),
      downtimeReason: v.reason!,
    };

    this.downtimeService.scheduleDowntime(payload).subscribe({
      next: () => {
        this.resetForm();
        this.downtimeTable.getAllDowntimes(true);
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  formatHour(h: number): string {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  }
}

/* ---------------- Utilities ---------------- */

function rangeValidator(minHoursGetter: () => number): ValidatorFn {
  return (group: AbstractControl) => {
    const sDate: Date | null = group.get('startDate')?.value ?? null;
    const sHour: number | null = group.get('startTime')?.value ?? null;
    const eDate: Date | null = group.get('endDate')?.value ?? null;
    const eHour: number | null = group.get('endTime')?.value ?? null;

    if (sDate == null || sHour == null || eDate == null || eHour == null) {
      return null;
    }

    const start = startOfHour(sDate, sHour);
    const end = startOfHour(eDate, eHour);

    if (end <= start) return { orderInvalid: true };

    const diffHours = (end.getTime() - start.getTime()) / 36e5;
    const min = minHoursGetter();

    if (diffHours < min) return { minDuration: { min } };
    if (Math.round(diffHours) !== diffHours) return { stepInvalid: true };
    return null;
  };
}

function startOfHour(date: Date, hour: number): Date {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours, 0, 0, 0);
  return d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameYMD(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
