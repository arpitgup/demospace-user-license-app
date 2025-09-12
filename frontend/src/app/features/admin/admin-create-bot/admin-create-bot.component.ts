import {
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Application } from '../../../core/models/application.model';
import { MatIconModule } from '@angular/material/icon';
import { AdminService } from '../../../core/services/admin.service';
import { MatCheckbox } from '@angular/material/checkbox';

@Component({
  selector: 'app-admin-create-bot',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatChipsModule,
    MatIconModule,
    MatCheckbox,
  ],
  templateUrl: './admin-create-bot.component.html',
  styleUrl: './admin-create-bot.component.scss',
})
export class AdminCreateBotComponent {
  readonly adminService = inject(AdminService);
  private readonly appMap = computed(
    () => new Map(this.apps().map((a) => [a.id, a]))
  );
  readonly selectedIds = signal<number[]>([]);
  readonly apps = signal<Application[]>([]);
  readonly filteredApps = computed(() => this.apps());
  private cdr = inject(ChangeDetectorRef);
  public isAdmin = signal<boolean>(false);
  removeApp(id: number): void {
    this.selectedIds.update((ids) => ids.filter((x) => x !== id));
  }

  appById(id: number): Application | undefined {
    return this.appMap().get(id);
  }

  constructor() {
    this.adminService
      .fetchAllApplications()
      .subscribe((apps) => this.apps.set(apps));
  }
  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  addApp(app: Application): void {
    if (this.isSelected(app.id)) return;
    this.selectedIds.update((ids) => [...ids, app.id]);
    this.cdr.detectChanges();
    // this.form.controls.applications.markAsDirty();
    // this.form.controls.applications.markAsTouched();
  }

  onSelectAdminReserved(isChecked: boolean) {
    this.isAdmin.set(isChecked);
  }

   onConfirm(): void {
    
  }

  onCancel(): void {
  
  }
}
