import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { DemoService } from '../../../core/services/demo.service';
import { DemoDetails } from '../../../core/models/demo-details.model';

@Component({
  selector: 'app-select-demo-dialog',
  imports: [
    MatDialogModule,
    MatIcon,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    FormsModule,
  ],
  templateUrl: './select-demo-dialog.html',
  styleUrl: './select-demo-dialog.scss',
})
export class SelectDemoDialog implements OnInit {
  private dialogRef = inject(MatDialogRef<SelectDemoDialog>);
  private demoService = inject(DemoService);
  private cdr = inject(ChangeDetectorRef);
  data = inject(MAT_DIALOG_DATA) as {
    currentDemos: DemoDetails[];
  };

  searchQuery = '';
  allDemos: DemoDetails[] = [];
  filteredDemos: DemoDetails[] = [];
  selectedDemoIds: Set<string> = new Set();
  selectedDemosMap: Map<string, DemoDetails> = new Map();
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    // Restore previously selected demos
    if (this.data?.currentDemos?.length > 0) {
      for (const demo of this.data.currentDemos) {
        this.selectedDemoIds.add(demo.demo_id);
        this.selectedDemosMap.set(demo.demo_id, demo);
      }
    }
    this.loadDemos();
  }

  loadDemos(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.demoService.fetchAllDemos().subscribe({
      next: (demos) => {
        this.allDemos = demos.filter(
          (demo) => demo.demo_onboarding_status === 'ACTIVE'
        );
        this.filteredDemos = [...this.allDemos];
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err.error?.detail || 'Failed to load demos. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  onSearchChange(): void {
    const query = this.searchQuery.toLowerCase().trim();
    if (query.length === 0) {
      this.filteredDemos = [...this.allDemos];
    } else {
      this.filteredDemos = this.allDemos.filter(
        (demo) =>
          demo.demo_id.toLowerCase().includes(query) ||
          demo.demo_title.toLowerCase().includes(query)
      );
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filteredDemos = [...this.allDemos];
  }

  isDemoSelected(demo: DemoDetails): boolean {
    return this.selectedDemoIds.has(demo.demo_id);
  }

  onToggleDemo(demo: DemoDetails): void {
    if (this.selectedDemoIds.has(demo.demo_id)) {
      this.selectedDemoIds.delete(demo.demo_id);
      this.selectedDemosMap.delete(demo.demo_id);
    } else {
      this.selectedDemoIds.add(demo.demo_id);
      this.selectedDemosMap.set(demo.demo_id, demo);
    }
    this.cdr.markForCheck();
  }

  getSelectedCount(): number {
    return this.selectedDemoIds.size;
  }

  onConfirm(): void {
    const selectedDemos = Array.from(this.selectedDemosMap.values());
    this.dialogRef.close(selectedDemos);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
