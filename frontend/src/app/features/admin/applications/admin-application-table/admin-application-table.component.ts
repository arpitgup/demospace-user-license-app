import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { TableLoaderComponent } from '../../../../loaders/table-loader/table-loader.component';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import { AdminService } from '../../../../core/services/admin.service';
import { LoaderService } from '../../../../core/services/loading.service';
import { Application } from '../../../../core/models/application.model';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialog } from '../../../../shared/dialogs/error-dialog/error-dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { toObservable } from '@angular/core/rxjs-interop';
import { UpdateApplicationRequest } from '../../../../core/models/update-application-request.model';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-admin-application-table',
  imports: [
    TableLoaderComponent,
    MatPaginatorModule,
    MatTableModule,
    ReactiveFormsModule,
    MatSortModule,
    ErrorMessage,
    MatCheckboxModule,
    ReactiveFormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './admin-application-table.component.html',
  styleUrl: './admin-application-table.component.scss',
})
export class AdminApplicationTableComponent implements OnInit, AfterViewInit {
  readonly adminService = inject(AdminService);
  public isLoading = signal(true);
  private fb = inject(FormBuilder);
  public isRefreshCall = signal(false);
  readonly loadingService = inject(LoaderService);
  dataSource = new MatTableDataSource<Application>([]);
  public readonly pageSizeOptions: number[] = [10];
  adminApplications: Application[] = [];
  adminApplicationsApiResponse: Application[] = [];
  public readonly botsResponse = this.adminService.bots;
  public readonly errorMessage = signal<string>('');
  private dialog = inject(MatDialog);
  readonly applicationNameController = new FormControl('');
  readonly licenseCountController = new FormControl('');
  private cdr = inject(ChangeDetectorRef);
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
    'applicationId',
    'application',
    'customSamlAttribute',
    'licenseType',
    'status',
    'licenseCount',
    'assignedToBots',
    'action',
  ];

  readonly SEARCH_APPLICATION_FORM = 'searchApplication';
  readonly SEARCH_LICENSE_TYPE = 'searchLicense';

  searchForm: FormGroup = this.fb.group({
    [this.SEARCH_APPLICATION_FORM]: [''],
    [this.SEARCH_LICENSE_TYPE]: [''],
  });

  constructor() {
    this.listenNewApplications();
  }
  ngOnInit(): void {
    this.getAllAdminApplications();
    this.listenFormChanges();
  }

  ngAfterViewInit() {
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'applicationId':
          return item.id;
        case 'application':
          return item.name;
        default:
          const value = item[property as keyof Application];
          return typeof value === 'string' || typeof value === 'number'
            ? value
            : String(value);
      }
    };
  }

  listenNewApplications() {
    toObservable(this.adminService.refreshApplications).subscribe((value) => {
      if (value === true) {
        this.getAllAdminApplications();
      }
      this.adminService.refreshApplicationsState.update(() => false);
    });
  }

  listenFormChanges() {
    this.searchForm.valueChanges?.subscribe(() => {
      if (this.isRefreshCall() === true) {
        return;
      }

      this.fetchSearchApplication(true);
    });
  }

  fetchSearchApplication(isRedirectToFirstPage: boolean) {
    this.dataSource.data = this.adminApplications
      .filter((item) =>
        this.searchForm.get(this.SEARCH_APPLICATION_FORM)?.value !== ''
          ? item.name
              .toLowerCase()
              .includes(
                this.searchForm
                  .get(this.SEARCH_APPLICATION_FORM)
                  ?.value?.toLowerCase()
              )
          : true
      )
      .filter((item) =>
        this.searchForm.get(this.SEARCH_LICENSE_TYPE)?.value !== ''
          ? item.licenseType
              ?.toLowerCase()
              ?.includes(
                this.searchForm
                  .get(this.SEARCH_LICENSE_TYPE)
                  ?.value?.toLowerCase()
              ) ?? true
          : true
      );
    if (this.dataSource.paginator && isRedirectToFirstPage === true) {
      this.dataSource.paginator.firstPage();
    }
  }

  onRefreshCall() {
    this.clearSearchValues();
    this.getAllAdminApplications();
  }

  clearSearchValues() {
    this.isRefreshCall.set(true);
    this.searchForm.get(this.SEARCH_APPLICATION_FORM)?.patchValue('');
    this.searchForm.get(this.SEARCH_LICENSE_TYPE)?.patchValue('');
    this.isRefreshCall.set(false);
  }
  //Fetch all admin applications
  getAllAdminApplications() {
    this.isLoading.set(true);
    this.adminService.fetchAllApplications().subscribe({
      next: (res) => {
        this.adminApplications = res.map((item) => ({
          ...item,
          remainingLicenseCount:
            (item.licenseCount ?? 0) - (item.licenseAssignedToBots ?? 0),
        }));
        this.adminApplicationsApiResponse = this.adminApplications.map(
          (item) => ({
            ...item,
          })
        );
        this.dataSource.data = this.adminApplications;
        this.clearSearchValues();
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.detail || 'Something went wrong');
        this.isLoading.set(false);
      },
    });
  }

  onRetryCall() {
    this.getAllAdminApplications();
  }

  onEditApplication(id: number) {
    this.adminApplications = this.adminApplications.map((element) => ({
      ...element,
      isEditable: element.id === id ? true : false,
    }));
    const applicationDetails = this.adminApplications.find(
      (element) => element.id === id
    );
    this.applicationNameController.setValue(applicationDetails?.name || '');
    this.licenseCountController.setValue(
      applicationDetails?.licenseCount?.toString() ?? '0'
    );
    this.applicationNameController.setValidators([Validators.required]);
    this.licenseCountController.setValidators([
      Validators.required,
      Validators.maxLength(3),
      Validators.min(applicationDetails?.licenseAssignedToBots ?? 0),
    ]);
    this.updateApplicationTable();
  }
  onSaveDetails(application: Application) {
    if (
      this.applicationNameController.invalid ||
      this.licenseCountController.invalid
    ) {
      return;
    }
    this.adminApplications = this.adminApplications.map((element) => ({
      ...element,
      isEditable: false,
    }));
    this.callUpdateApplicationApi(
      application,
      this.applicationNameController.value,
      this.licenseCountController.value
    );

    this.clearFormValues();
    this.cdr.detectChanges();
  }
  onCancelUpdate(id: number) {
    const application = this.adminApplicationsApiResponse.find(
      (item) => item.id === id
    );
    this.adminApplications = this.adminApplications.map((element) => {
      if (element.id === application?.id) {
        element.licenseAssignedToBots = application?.licenseAssignedToBots;
        element.licenseCount = application?.licenseCount;
        element.remainingLicenseCount = application?.remainingLicenseCount;
        element.name = application?.name ?? '';
        element.isActive = application?.isActive ?? false;
      }

      element.isEditable = false;
      return element;
    });
    this.clearFormValues();
    this.updateApplicationTable();
  }
  clearFormValues() {
    this.applicationNameController.setValue('');
    this.licenseCountController.setValue('');
  }
  onActiveApplication(value: boolean, applicationId: number) {
    this.adminApplications = this.adminApplications.map((element) => ({
      ...element,
      isActive: element.id === applicationId ? value : element.isActive,
    }));
    this.updateApplicationTable();
  }

  updateApplicationTable() {
    // this.dataSource.data = this.adminApplications;
    this.fetchSearchApplication(false);
  }

  callUpdateApplicationApi(
    application: Application,
    applicationName: string | null,
    licenseCount: string | null
  ) {
    const request: UpdateApplicationRequest = {
      applications: [
        {
          id: application.id,
          name: applicationName ?? '',
          isActive: application.isActive,
          licenseType: application.licenseType,
          licenseGroup: application.licenseGroup,
          licenseCount: licenseCount ?? '0',
        },
      ],
    };
    this.loadingService.show();
    this.adminService.updateApplication(request).subscribe({
      next: () => {
        this.loadingService.hide();
        this.getAllAdminApplications();
      },
      error: (error) => {
        this.loadingService.hide();
        this.showErrorDialog(error.error.detail || 'Something went wrong');
      },
    });
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
}
