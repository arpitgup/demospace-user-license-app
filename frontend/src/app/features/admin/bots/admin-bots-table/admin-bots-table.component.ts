import {
  AfterViewInit,
  Component,
  inject,
  Input,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { AdminService } from '../../../../core/services/admin.service';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { AdminBotsResponse } from '../../../../core/models/admin-bots-response.model';
import { TableLoaderComponent } from '../../../../loaders/table-loader/table-loader.component';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { Application } from '../../../../core/models/application.model';
import { concatMap, forkJoin, map, of } from 'rxjs';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  BotRequest,
  UpdateBotRequest,
} from '../../../../core/models/update-bot-request.model';
import { LoaderService } from '../../../../core/services/loading.service';
import { MatCheckbox } from '@angular/material/checkbox';
import { BotService } from '../../../../core/services/bot.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { ErrorDialog } from '../../../../shared/dialogs/error-dialog/error-dialog';
import { MatDialog } from '@angular/material/dialog';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import { MatIconModule } from '@angular/material/icon';
import { BotsConstants } from '../bots.constants';
import { MatRadioModule } from '@angular/material/radio';
import { AssignApplicationsBotsDialog } from '../../../../shared/dialogs/assign-applications-bots-dialog/assign-applications-bots-dialog';

@Component({
  selector: 'app-admin-bots-table',
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
    MatRadioModule,
  ],
  templateUrl: './admin-bots-table.component.html',
  styleUrl: './admin-bots-table.component.scss',
})
export class AdminBotsTableComponent implements OnInit, AfterViewInit {
  readonly adminService = inject(AdminService);
  readonly botsService = inject(BotService);
  public isLoading = signal(true);
  readonly loadingService = inject(LoaderService);
  @Input() searchBotControl?: FormControl;
  dataSource = new MatTableDataSource<AdminBotsResponse>([]);
  public readonly pageSizeOptions: number[] = [10];
  adminApplications: Application[] = [];
  adminBotsList: AdminBotsResponse[] = [];
  public readonly botsResponse = this.adminService.bots;
  public readonly errorMessage = signal<string>('');
  public selectAllBots = signal<boolean>(false);
  public isBulkAllocationVisible = signal<boolean>(false);
  private dialog = inject(MatDialog);
  applicationList: Application[] = [];
  botApplicationDetailsList: AdminBotsResponse[] = [];
  botsConstants = BotsConstants;
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
    'select',
    'botId',
    'botName',
    'botEmail',
    'applications',
    'reserved',
    'action',
  ];

  constructor() {
    this.listenBotsChanges();
  }

  ngOnInit(): void {
    this.getAllAdminBots();
    this.listenSearchBotValues();
  }
  listenSearchBotValues() {
    this.searchBotControl?.valueChanges?.subscribe((value) => {
      this.filteredListWithSearch(value || '', true);
    });
  }
  filteredListWithSearch(value: string, redirctToInitialPage: boolean) {
    if (value === null || value === undefined) {
      return;
    }
    const newValue = value.trim().toLowerCase();
    if (newValue && newValue !== '') {
      if (newValue.includes('to') || newValue.includes('-')) {
        const parts = newValue.includes('to')
          ? newValue.split('to').map((v) => v.trim())
          : newValue.split('-').map((v) => v.trim());
        if (parts.length === 2) {
          const [start, end] = parts;
          if (!isNaN(Number(start)) && !isNaN(Number(end))) {
            const startIndex = Number(start);
            const endIndex = Number(end);
            if (startIndex < endIndex && startIndex >= 1) {
              this.dataSource.data = this.adminBotsList.filter(
                (item) => item.id >= startIndex && item.id <= endIndex
              );
              return;
            }
          }
        }
      }
      this.dataSource.data = this.adminBotsList.filter(
        (item) =>
          item.applications.some((application) =>
            application.name.toLowerCase().includes(newValue)
          ) ||
          item.email.toLowerCase().includes(newValue) ||
          item.id.toString().toLowerCase().includes(newValue) ||
          item.name.toString().toLowerCase().includes(newValue)
      );
    } else {
      this.dataSource.data = this.adminBotsList;
    }
    if (this.dataSource.paginator && redirctToInitialPage) {
      this.dataSource.paginator.firstPage();
    }
  }

  listenBotsChanges() {
    toObservable(this.botsService.refreshBots).subscribe((value) => {
      if (value === true) {
        this.getAllAdminBots();
      }
      this.botsService.refreshBotsState.update(() => false);
    });
  }

  ngAfterViewInit() {
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'botId':
          return item.id;
        case 'botEmail':
          return item.email;
        default:
          const value = item[property as keyof AdminBotsResponse];
          return typeof value === 'string' || typeof value === 'number'
            ? value
            : String(value);
      }
    };
  }

  getAllAdminBots() {
    forkJoin({
      adminBots: this.botsService.fetchAllAdminBots(),
      applications: this.adminService.fetchAllApplications(),
    }).subscribe({
      next: (data) => {
        this.applicationList = data.applications;
        this.updateApplicationAvailability(data.applications);
        this.adminBotsList = data.adminBots
          .map((item) => {
            item.applicationIds = item.applications.map((item) => item.id);
            return item;
          })
          .sort((a, b) => a.id - b.id);
        this.botApplicationDetailsList = this.adminBotsList.map((item) => ({
          ...item,
        }));
        this.dataSource.data = this.adminBotsList;
        this.searchBotControl?.patchValue('');
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error?.error?.detail || 'Something went wrong');
      },
    });
  }

  updateApplicationAvailability(applications: Application[]) {
    this.adminApplications = applications.map((element) => ({
      ...element,
      isEnabled: (element.isEnabled =
        (element.licenseAssignedToBots ?? 0) < (element.licenseCount ?? 0)
          ? true
          : false),
      remainingLicenseCount:
        (element.licenseCount ?? 0) - (element.licenseAssignedToBots ?? 0),
    }));
  }

  onEditBot(botId: number) {
    this.adminBotsList = this.adminBotsList.map((item) => {
      if (item.id === botId) {
        item.isEditable = true;
      } else {
        item.isEditable = false;
      }
      return item;
    });
    this.updateBotsTable();
  }

  onSaveBotDetails(botId: number) {
    const adminBot = this.adminBotsList.filter((item) => item.id === botId);
    this.callUpdateBotApi(botId, adminBot[0]);
  }

  onCancelUpdateBot(botId: number) {
    this.updateApplicationAvailability(this.applicationList);
    const bot = this.botApplicationDetailsList.find(
      (item) => item.id === botId
    );
    this.adminBotsList = this.adminBotsList.map((item) => {
      if (item.id === botId) {
        item.isEditable = false;
        item.applicationIds = bot?.applicationIds ?? [];
        item.isAdmin = bot?.isAdmin ?? false;
      }
      return item;
    });
    this.updateBotsTable();
  }

  onSelectionChange(event: MatSelectChange, bot: AdminBotsResponse) {
    if (event.value) {
      const previousValue: number[] = this.adminBotsList.filter(
        (item) => item.id === bot.id
      )[0].applicationIds;
      const currentValue: number[] = event.value;
      const selectedValues = currentValue.filter(
        (value) => !previousValue.includes(value)
      );
      const deselectedValues = previousValue.filter(
        (value) => !currentValue.includes(value)
      );
      if (selectedValues.length > 0 || deselectedValues.length > 0) {
        this.adminApplications = this.adminApplications.map((item) => {
          if (selectedValues.includes(item.id)) {
            item.licenseAssignedToBots = (item.licenseAssignedToBots ?? 0) + 1;
          } else if (deselectedValues.includes(item.id)) {
            item.licenseAssignedToBots = (item.licenseAssignedToBots ?? 0) - 1;
          }
          return item;
        });
      }
      this.updateApplicationAvailability(this.adminApplications);
      this.adminBotsList = this.adminBotsList.map((item) => {
        if (item.id === bot.id) {
          item.applicationIds = event.value;
        }
        return item;
      });
      this.updateBotsTable();
    }
  }

  onSelectAdminReserved(checked: boolean, botId: number) {
    this.adminBotsList = this.adminBotsList.map((item) => {
      if (item.id === botId) {
        item.isAdmin = checked;
      }
      return item;
    });
    this.updateBotsTable();
  }

  callUpdateBotApi(botId: number, botResponse: AdminBotsResponse) {
    this.loadingService.show();
    const bots: BotRequest[] = [
      {
        id: botId,
        is_admin: botResponse.isAdmin,
        application_ids: botResponse.applicationIds,
      },
    ];
    const botsRequest: UpdateBotRequest = {
      bots: bots,
    };
    of(null)
      .pipe(
        concatMap(() =>
          this.botsService
            .updateBots(botsRequest)
            .pipe(map((bots) => ({ bots })))
        ),
        concatMap((bots) =>
          this.adminService
            .fetchAllApplications()
            .pipe(map((applications) => ({ ...bots, applications })))
        )
      )
      .subscribe({
        next: (res) => {
          this.adminBotsList = this.adminBotsList.map((item) => {
            if (item.id === botId) {
              item.isEditable = false;
            }
            return item;
          });
          this.updateApplicationAvailability(res.applications);
          this.applicationList = res.applications;
          const index = this.adminBotsList.findIndex(
            (item) => item.id === botId
          );
          const adminBotResponse = res.bots.filter((item) => item.id === botId);
          adminBotResponse[0].applicationIds = res.bots[0].applications.map(
            (item) => item.id
          );

          this.adminBotsList.splice(index, 1, adminBotResponse[0]);
          this.botApplicationDetailsList = this.adminBotsList.map((item) => ({
            ...item,
          }));
          this.updateBotsTable();
        },
        error: (error) => {
          this.loadingService.hide();
          this.showErrorDialog(error?.error?.detail || 'Something went wrong');
        },
        complete: () => {
          this.loadingService.hide();
        },
      });
  }

  updateBotsTable() {
    this.filteredListWithSearch(this.searchBotControl?.value || '', false);
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
    this.getAllAdminBots();
  }
  onSelectAllBots(value: boolean) {
    this.adminBotsList = this.adminBotsList.map((item) => ({
      ...item,
      isSelect: value,
    }));
    this.updateBotsTable();
    this.updateBulkAllocationValue(value);
  }

  onSelectBots(value: boolean, id: number) {
    this.adminBotsList = this.adminBotsList.map((item) => ({
      ...item,
      isSelect: id === item.id ? value : item.isSelect,
    }));
    if (this.adminBotsList.some((item) => item.isSelect === true)) {
      this.updateBulkAllocationValue(true);
    } else {
      this.updateBulkAllocationValue(false);
    }
  }
  updateBulkAllocationValue(value: boolean) {
    this.isBulkAllocationVisible.update(() => value);
  }

  callAssigApplicationToBots() {
    const dialogRef = this.dialog.open(AssignApplicationsBotsDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: '50rem',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        applications: this.applicationList,
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
      }
    });
  }
}
