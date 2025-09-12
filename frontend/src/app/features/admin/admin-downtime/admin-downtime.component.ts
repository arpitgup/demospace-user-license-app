import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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

import { DowntimeService, ScheduleDowntimeRequest } from '../../../core/services/downtime.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { Application } from '../../../core/models/application.model';
import { MIN_DOWNTIME_HOURS } from './min-downtime.token';
import { ADMIN_DOWNTIME_CONSTANTS } from './admin-downtime.constants';
import { AdminDowntimeTableComponent } from './admin-downtime-table/admin-downtime-table.component';
import { addHours, isSameYMD, rangeValidator, startOfDay, startOfHour } from './admin-downtime.utils';

type DowntimeReason = string;

@Component({
  selector: 'app-admin-downtime',
  imports: [
    CommonModule, MatTabsModule, AdminDowntimeTableComponent, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
    MatButtonModule, MatChipsModule, MatIconModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './admin-downtime.component.html',
  styleUrl: './admin-downtime.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { ngSkipHydration: 'true' },
})
export class AdminDowntimeComponent {
  private readonly fb = inject(FormBuilder);
  private readonly downtimeService = inject(DowntimeService);
  private readonly reservationService = inject(ReservationService);

  @ViewChild(AdminDowntimeTableComponent)
  private downtimeTable!: AdminDowntimeTableComponent;

  readonly constants = ADMIN_DOWNTIME_CONSTANTS;
  readonly minHours = MIN_DOWNTIME_HOURS;
  readonly isSubmitting = signal(false);
  readonly apps = signal<Application[]>([]);
  readonly reasons = signal<DowntimeReason[]>([
    'Maintenance', 'Version Update', 'Security Patch', 'Planned Outage', 'Other',
  ]);
  readonly HOURS = Array.from({ length: 24 }, (_, h) => h);

  readonly selectedIds = signal<number[]>([]);

  readonly form = this.fb.group({
    applications: this.fb.control<number[]>([], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    startDate: this.fb.control<Date | null>(null, { validators: [Validators.required] }),
    startTime: this.fb.control<number | null>(null, { validators: [Validators.required] }),
    endDate: this.fb.control<Date | null>(null, { validators: [Validators.required] }),
    endTime: this.fb.control<number | null>(null, { validators: [Validators.required] }),
    reason: this.fb.control<DowntimeReason | null>(null, { validators: [Validators.required] }),
  }, { validators: [rangeValidator(() => this.minHours)] });

  private readonly appMap = computed(() => new Map(this.apps().map((a) => [a.id, a])));
  readonly filteredApps = computed(() => this.apps());
  readonly endHourOptions = computed<number[]>(() => {
    const sDate = this.form.controls.startDate.value;
    const sHour = this.form.controls.startTime.value;
    const eDate = this.form.controls.endDate.value;

    if (!sDate || sHour === null || !eDate || !isSameYMD(sDate, eDate)) {
      return this.HOURS;
    }
    return this.HOURS.filter((h) => h >= sHour + this.minHours);
  });

  readonly startDateFilter = (d: Date | null): boolean => {
    return d ? startOfDay(d) >= startOfDay(new Date()) : false;
  };

  readonly endDateFilter = (d: Date | null): boolean => {
    if (!d) return false;
    const sDate = this.form.controls.startDate.value;
    const minDate = sDate ? startOfDay(sDate) : startOfDay(new Date());
    return startOfDay(d) >= minDate;
  };

  constructor() {
    this.reservationService.getApplications().subscribe((apps) => this.apps.set(apps));
    this.initializeEffects();
  }

  private initializeEffects(): void {
    effect(() => {
      const { startDate, startTime, endDate, endTime } = this.form.getRawValue();
      if (startDate && startTime !== null) {
        const minEnd = addHours(startOfHour(startDate, startTime), this.minHours);
        const endMissing = !endDate || endTime === null;
        const endTooEarly = !endMissing && startOfHour(endDate, endTime) < minEnd;

        if (endMissing || endTooEarly) {
          this.form.patchValue(
            { endDate: minEnd, endTime: minEnd.getHours() },
            { emitEvent: false }
          );
        }
      }
    });

    effect(() => {
      this.form.controls.applications.setValue(this.selectedIds());
    });
  }

  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  addApp(app: Application): void {
    if (this.isSelected(app.id)) return;
    this.selectedIds.update((ids) => [...ids, app.id]);
    this.form.controls.applications.markAsDirty();
    this.form.controls.applications.markAsTouched();
  }

  removeApp(id: number): void {
    this.selectedIds.update((ids) => ids.filter((x) => x !== id));
    this.form.controls.applications.markAsDirty();
    this.form.controls.applications.markAsTouched();
  }

  appById(id: number): Application | undefined {
    return this.appMap().get(id);
  }

  onStartDateChanged(): void {
    const sDate = this.form.controls.startDate.value;
    const eDate = this.form.controls.endDate.value;
    if (sDate && eDate && startOfDay(eDate) < startOfDay(sDate)) {
      this.form.patchValue({ endDate: sDate }, { emitEvent: false });
    }
  }

  onEndDateChanged(): void {}
  onStartTimeChanged(): void {}

  resetForm(): void {
    this.form.reset();
    this.selectedIds.set([]);
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
      error: () => this.isSubmitting.set(false),
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