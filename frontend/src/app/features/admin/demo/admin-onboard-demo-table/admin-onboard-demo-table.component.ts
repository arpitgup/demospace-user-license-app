import { Component, inject, signal, ViewChild } from '@angular/core';
import { TableLoaderComponent } from '../../../../loaders/table-loader/table-loader.component';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCheckbox } from '@angular/material/checkbox';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import { MatIconModule } from '@angular/material/icon';
import { AdminService } from '../../../../core/services/admin.service';
import { LoaderService } from '../../../../core/services/loading.service';
import { DemoDetails } from '../../../../core/models/demo-details.model';
import { MatDialog } from '@angular/material/dialog';
import { Application } from '../../../../core/models/application.model';
import { DemoService } from '../../../../core/services/demo.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ErrorDialog } from '../../../../shared/dialogs/error-dialog/error-dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { OrganizationUnit } from '../../../../core/models/organization-unit.model';
import { DemoOnBoardingEnum } from '../../../../enums/admin-demo-onboarding.enums';
import { SuccessDialog } from '../../../../shared/dialogs/success-dialog/success-dialog';
import { DEMOCONSTANTS } from '../demo.constants';
import { UpdateDemoDialog } from '../../../../shared/dialogs/update-demo-dialog/update-demo-dialog';
import { ReservationService } from '../../../../core/services/reservation.service';

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
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './admin-onboard-demo-table.component.html',
  styleUrl: './admin-onboard-demo-table.component.scss',
})
export class AdminOnboardDemoTableComponent {
  readonly adminService = inject(AdminService);
  readonly fb = inject(FormBuilder);
  readonly demoService = inject(DemoService);
  readonly reservationService = inject(ReservationService);
  public isLoading = signal(true);
  readonly loadingService = inject(LoaderService);
  dataSource = new MatTableDataSource<DemoDetails>([]);
  public readonly pageSizeOptions: number[] = [10];
  initialAdminDemoResponse: DemoDetails[] = [];
  adminDemoList: DemoDetails[] = [];
  public readonly errorMessage = signal<string>('');
  private dialog = inject(MatDialog);
  applicationList: Application[] = [];
  organizationUnit: OrganizationUnit[] = [];
  demoApplicationDetailsList: DemoDetails[] = [];
  readonly demoTitleController = new FormControl('');
  readonly geminiEnterpriseLinkController = new FormControl('');
  readonly driveLinkController = new FormControl('');
  readonly groupEmailController = new FormControl('');
  readonly orgUnitController = new FormControl('');
  readonly demoStatusController = new FormControl('');
  readonly demoConstants = DEMOCONSTANTS;
  public isRefreshCall = signal(false);
  public showDeprecatedDemos = signal(false);
  DEFAULT_DEMO_SUMMARY = '';
  demoOnBoardingStatus: DemoOnBoardingEnum[] = [
    DemoOnBoardingEnum.ACTIVE,
    DemoOnBoardingEnum.INACTIVE,
    DemoOnBoardingEnum.DEPRECATED,
  ];
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
    'artifactLinks',
    'demoOnBoardedStatus',
    'featureLicenseApp',
    'saasApplications',
    'orgUnit',
    'action',
  ];

  readonly SEARCH_DEMO_ID_FORM = 'searchDemoId';
  readonly SEARCH_DEMO_TITLE_FORM = 'searchDemoTitle';
  readonly SEARCH_APPLICATIONS_FORM = 'searchApplications';
  readonly SEARCH_ORG_UNIT_FORM = 'searchOrgUnit';

  searchForm: FormGroup = this.fb.group({
    [this.SEARCH_DEMO_ID_FORM]: [''],
    [this.SEARCH_DEMO_TITLE_FORM]: [''],
    [this.SEARCH_APPLICATIONS_FORM]: [''],
    [this.SEARCH_ORG_UNIT_FORM]: [''],
  });

  constructor() {
    this.listenDemoChanges();
  }

  ngOnInit(): void {
    this.getAllDemos();
    this.listenSearchValues();
  }

  listenDemoChanges() {
    toObservable(this.demoService.refreshDemos).subscribe((value) => {
      if (value === true) {
        this.getAllDemos();
      }
      this.demoService.refreshDemoState.update(() => false);
    });
  }

  listenSearchValues() {
    this.searchForm.valueChanges?.subscribe(() => {
      if (this.isRefreshCall() === true) {
        return;
      }

      this.fetchSearchDemos(true);
    });
  }

  fetchSearchDemos(isRedirectToFirstPage: boolean) {
    let filteredDemos: DemoDetails[] = [];
    if (this.showDeprecatedDemos() === true) {
      filteredDemos = this.adminDemoList.filter(
        (item) => item.demo_onboarding_status === DemoOnBoardingEnum.DEPRECATED,
      );
    } else {
      filteredDemos = this.adminDemoList.filter(
        (item) =>
          item.demo_onboarding_status === DemoOnBoardingEnum.ACTIVE ||
          item.demo_onboarding_status === DemoOnBoardingEnum.INACTIVE,
      );
    }
    this.dataSource.data = filteredDemos
      .filter((item) =>
        this.searchForm.get(this.SEARCH_DEMO_ID_FORM)?.value !== ''
          ? item.demo_id
              .toLowerCase()
              .includes(
                this.searchForm
                  .get(this.SEARCH_DEMO_ID_FORM)
                  ?.value?.toLowerCase(),
              )
          : true,
      )
      .filter((item) =>
        this.searchForm.get(this.SEARCH_DEMO_TITLE_FORM)?.value !== ''
          ? (item.demo_title
              ?.toLowerCase()
              ?.includes(
                this.searchForm
                  .get(this.SEARCH_DEMO_TITLE_FORM)
                  ?.value?.toLowerCase(),
              ) ?? true)
          : true,
      )
      .filter((item) =>
        this.searchForm.get(this.SEARCH_APPLICATIONS_FORM)?.value !== ''
          ? (item.applications.some((application) =>
              application.name
                .toLowerCase()
                .includes(
                  this.searchForm
                    .get(this.SEARCH_APPLICATIONS_FORM)
                    ?.value?.toLowerCase(),
                ),
            ) ?? true)
          : true,
      )
      .filter((item) =>
        this.searchForm.get(this.SEARCH_ORG_UNIT_FORM)?.value !== ''
          ? (item.organization_unit
              ?.toLowerCase()
              ?.includes(
                this.searchForm
                  .get(this.SEARCH_ORG_UNIT_FORM)
                  ?.value?.toLowerCase(),
              ) ?? true)
          : true,
      );
    if (this.dataSource.paginator && isRedirectToFirstPage === true) {
      this.dataSource.paginator.firstPage();
    }
  }

  ngAfterViewInit() {
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'demoId':
          return item.demo_id;
        case 'demoTitle':
          return item.demo_title;
        case 'orgUnit':
          return item.organization_unit;
        default:
          const value = item[property as keyof DemoDetails];
          return typeof value === 'string' || typeof value === 'number'
            ? value
            : String(value);
      }
    };
  }

  onRefreshCall() {
    this.clearSearchValues();
    this.getAllDemos();
  }

  onShowDeprecatedDemo(checked: boolean): void {
    this.showDeprecatedDemos.set(checked);
    this.clearSearchValues();
    this.updateDemosDataSource();
  }
  updateDemosDataSource() {
    if (this.showDeprecatedDemos() === true) {
      this.dataSource.data = this.adminDemoList.filter(
        (item) => item.demo_onboarding_status === DemoOnBoardingEnum.DEPRECATED,
      );
    } else {
      this.dataSource.data = this.adminDemoList.filter(
        (item) =>
          item.demo_onboarding_status === DemoOnBoardingEnum.ACTIVE ||
          item.demo_onboarding_status === DemoOnBoardingEnum.INACTIVE,
      );
    }
  }

  clearSearchValues() {
    this.isRefreshCall.set(true);
    this.searchForm.get(this.SEARCH_DEMO_ID_FORM)?.patchValue('');
    this.searchForm.get(this.SEARCH_DEMO_TITLE_FORM)?.patchValue('');
    this.searchForm.get(this.SEARCH_ORG_UNIT_FORM)?.patchValue('');
    this.searchForm.get(this.SEARCH_APPLICATIONS_FORM)?.patchValue('');
    this.isRefreshCall.set(false);
  }

  getAllDemos() {
    this.isLoading.update(() => true);
    forkJoin({
      adminDemos: this.demoService.fetchAllDemos(),
      applications: this.adminService.fetchAllApplications(),
      organizationUnit: this.demoService.fetchAllOrganizations(),
      appConfig: this.reservationService.getConfig(),
    }).subscribe({
      next: (data) => {
        this.DEFAULT_DEMO_SUMMARY = data.appConfig.defaultDemoSummary || '';
        this.applicationList = data.applications;
        this.organizationUnit = data.organizationUnit;
        this.adminDemoList = data.adminDemos.map((item) => {
          item.applications = this.getDemoApplications(
            item.saas_applications,
            data.applications,
          );
          return item;
        });
        this.initialAdminDemoResponse = this.adminDemoList.map((item) => ({
          ...item,
        }));
        this.clearSearchValues();
        this.dataSource.data = this.adminDemoList;
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error?.error?.detail || 'Something went wrong');
      },
    });
  }

  getDemoAppLinkUrl(demo: DemoDetails, index: number) {
    if (
      demo.artifact_links !== null &&
      demo.artifact_links.length >= index + 1
    ) {
      return demo.artifact_links[index].url;
    } else {
      return '';
    }
  }
  getDemoApplications(
    saas_applications: string,
    applications: Application[],
  ): Application[] {
    const applicationIds = saas_applications.split(',').map(Number);
    return applications.filter((item) => applicationIds.includes(item.id));
  }

  onEditDemo(demoId: string) {
    const dialogRef = this.dialog.open(UpdateDemoDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: '70rem',
      minHeight: 'none',
      maxHeight: 'none',
      data: {
        application: this.applicationList,
        organizationUnit: this.organizationUnit,
        defaultDemoSummary: this.DEFAULT_DEMO_SUMMARY,
        demoDetails: this.initialAdminDemoResponse.find(
          (item) => item.demo_id === demoId,
        ),
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result && typeof result.demo_id === 'string') {
        this.showSuccessDialog();
        const index = this.adminDemoList.findIndex(
          (item) => item.demo_id == result.demo_id,
        );
        this.adminDemoList.splice(index, 1, result);

        this.initialAdminDemoResponse = this.adminDemoList.map((item) => {
          return item;
        });
        this.updateDemosTable();
      }
    });
  }

  updateDemosTable() {
    this.fetchSearchDemos(false);
  }
  showSuccessDialog() {
    const dialogRef = this.dialog.open(SuccessDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        title: 'Success',
        message: 'Demo updated successfully',
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed().subscribe(() => {});
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
