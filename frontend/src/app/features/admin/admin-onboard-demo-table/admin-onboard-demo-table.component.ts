import { Component, inject, signal, ViewChild } from '@angular/core';
import { TableLoaderComponent } from '../../../loaders/table-loader/table-loader.component';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCheckbox } from '@angular/material/checkbox';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import { MatIconModule } from '@angular/material/icon';
import { AdminService } from '../../../core/services/admin.service';
import { LoaderService } from '../../../core/services/loading.service';
import { DemoDetails } from '../../../core/models/demo-details.model';
import { MatDialog } from '@angular/material/dialog';
import { Application } from '../../../core/models/application.model';
import { DemoService } from '../../../core/services/demo.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ErrorDialog } from '../../../shared/dialogs/error-dialog/error-dialog';

@Component({
  selector: 'app-admin-onboard-demo-table',
  imports: [
    TableLoaderComponent,
    MatPaginatorModule,
    MatTableModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatSortModule,
    MatCheckbox,
    ErrorMessage,
    MatIconModule,
  ],
  templateUrl: './admin-onboard-demo-table.component.html',
  styleUrl: './admin-onboard-demo-table.component.scss',
})
export class AdminOnboardDemoTableComponent {
  readonly adminService = inject(AdminService);
  readonly demoService = inject(DemoService);
  public isLoading = signal(true);
  readonly loadingService = inject(LoaderService);
  dataSource = new MatTableDataSource<DemoDetails>([]);
  public readonly pageSizeOptions: number[] = [10];
  adminDemo: DemoDetails[] = [];
  adminDemoList: DemoDetails[] = [];
  public readonly errorMessage = signal<string>('');
  private dialog = inject(MatDialog);
  applicationList: Application[] = [];
  demoApplicationDetailsList: DemoDetails[] = [];
  readonly demoTitleController = new FormControl('');
  readonly geminiEnterpriseLinkController = new FormControl('');
  readonly driveLinkController = new FormControl('');
  @ViewChild(MatSort) set sort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  @ViewChild(MatPaginator) set paginator(value: MatPaginator) {
    if (value) {
      this.dataSource.paginator = value;
    }
  }

  displayedColumns: string[] = [
    'demoId',
    'demoTitle',
    'demoUserGroupEmail',
    'geminiEnterpriseAppLink',
    'driveFolderLink',
    'demoOnBoardedStatus',
    'featureLicenseApp',
    'saasApplications',
    'orgUnit',
    'action',
  ];

  constructor() {
    this.listenDemoChanges();
  }

  ngOnInit(): void {
    this.getAllDemos();
  }

  listenDemoChanges() {
    toObservable(this.demoService.refreshDemos).subscribe((value) => {
      if (value === true) {
        this.getAllDemos();
      }
      this.demoService.refreshDemoState.update(() => false);
    });
  }

  ngAfterViewInit() {
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'demoId':
          return item.demo_id;
        case 'demoTitle':
          return item.demo_title;
        default:
          const value = item[property as keyof DemoDetails];
          return typeof value === 'string' || typeof value === 'number'
            ? value
            : String(value);
      }
    };
  }

  getAllDemos() {
    forkJoin({
      adminDemos: this.demoService.fetchAllDemos(),
      applications: this.adminService.fetchAllApplications(),
    }).subscribe({
      next: (data) => {
        this.applicationList = data.applications;
        this.adminDemoList = data.adminDemos.map((item) => {
          item.applications = this.getDemoApplications(
            item.saas_applications,
            data.applications
          );
          return item;
        });

        this.dataSource.data = this.adminDemoList;
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error?.error?.detail || 'Something went wrong');
      },
    });
  }
  getDemoApplications(
    saas_applications: string,
    applications: Application[]
  ): Application[] {
    const applicationIds = saas_applications.split(',').map(Number);
    return applications.filter((item) => applicationIds.includes(item.id));
  }

  onEditDemo(demoId: string) {
    this.adminDemoList = this.adminDemoList.map((item) => {
      if (item.demo_id === demoId) {
        this.demoTitleController.setValue(item?.demo_title || '');
        this.geminiEnterpriseLinkController.setValue(
          item?.gemini_enterprise_app_link || ''
        );
        this.driveLinkController.setValue(item?.drive_folder_link || '');
        item.isEdit = true;
      } else {
        item.isEdit = false;
      }
      return item;
    });

    this.updateDemosTable();
  }

  onSaveDemoDetails(demoId: string) {
    this.adminDemoList = this.adminDemoList.map((item) => {
      if (item.demo_id === demoId) {
        item.isEdit = false;
      }
      return item;
    });
    const adminDemo = this.adminDemoList.filter(
      (item) => item.demo_id === demoId
    );
    this.updateDemosTable();
    this.callUpdateDemo(demoId, adminDemo[0]);
  }

  onCancelUpdateDemo(demoId: string) {
    const demo = this.adminDemoList.find((item) => item.demo_id === demoId);
    this.adminDemoList = this.adminDemoList.map((item) => {
      if (item.demo_id === demoId) {
        item.isEdit = false;
      }
      return item;
    });
    this.updateDemosTable();
  }

  onSelectionChange(event: MatSelectChange, demo: DemoDetails) {
    if (event.value) {
      this.adminDemoList = this.adminDemoList.map((item) => {
        if (item.demo_id === demo.demo_id) {
          item.applicationIds = event.value;
        }
        return item;
      });
      this.updateDemosTable();
    }
  }

  onSelectDemoOnBoarded(checked: boolean, demoId: string) {}

  onSelectFeatureLicense(checked: boolean, demoId: string) {}

  callUpdateDemo(demoId: string, demoDetails: DemoDetails) {}

  updateDemosTable() {
    this.dataSource.data = this.adminDemoList;
  }
  showErrorDialog(errorMessage: string) {
    this.dialog.open(ErrorDialog, {
      width: 'auto',
      minWidth: '41.86rem',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        message: errorMessage,
      },
    });
  }

  onRetryCall() {
    this.getAllDemos();
  }
}
