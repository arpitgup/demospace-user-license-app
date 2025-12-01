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
import { AllocationErrorMessage } from '../../../../core/models/allocation-error-message.model';
import { SuccessDialog } from '../../../../shared/dialogs/success-dialog/success-dialog';

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
        if (item.isEditable === true) {
          this.updateWithPreviousValue(item, botId);
        }
        item.isEditable = false;
      }
      item.isSelect = false;
      return item;
    });
    this.selectAllBots.update(() => false);
    this.updateBulkAllocationValue(false);
    this.updateBotsTable();
  }

  onSaveBotDetails(botId: number) {
    const adminBot = this.adminBotsList.filter((item) => item.id === botId);
    const bots: BotRequest[] = [
      {
        id: botId,
        is_admin: adminBot[0].isAdmin,
        application_ids: adminBot[0].applicationIds,
      },
    ];

    this.callUpdateBotApi(bots, 'Bot updated successfully');
  }

  onCancelUpdateBot(botId: number) {
    this.adminBotsList = this.adminBotsList.map((item) => {
      if (item.id === botId) {
        this.updateWithPreviousValue(item, botId);
      }
      return item;
    });
    this.updateBotsTable();
  }
  updateWithPreviousValue(botResponse: AdminBotsResponse, botId: number) {
    this.updateApplicationAvailability(this.applicationList);
    const bot = this.botApplicationDetailsList.find(
      (item) => item.id === botId
    );
    botResponse.isEditable = false;
    botResponse.applicationIds = bot?.applicationIds ?? [];
    botResponse.isAdmin = bot?.isAdmin ?? false;
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

  callUpdateBotApi(botsRequest: BotRequest[], botUpdationMessage: string) {
    this.loadingService.show();
    const payload: UpdateBotRequest = {
      bots: botsRequest,
    };
    of(null)
      .pipe(
        concatMap(() =>
          this.botsService.updateBots(payload).pipe(map((bots) => ({ bots })))
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
            item.isEditable = false;
            return item;
          });
          this.updateApplicationAvailability(res.applications);
          this.applicationList = res.applications;
          const updatedBotIds = botsRequest.map((item) => item.id);

          this.adminBotsList = this.adminBotsList.map((item) => {
            if (updatedBotIds.includes(item.id)) {
              const bot = res.bots.find((bot) => item.id === bot.id);
              if (bot) {
                bot.applicationIds = bot.applications.map((item) => item.id);
                return bot;
              } else {
                return item;
              }
            }
            return item;
          });

          this.botApplicationDetailsList = this.adminBotsList.map((item) => ({
            ...item,
          }));
          this.selectAllBots.update(() => false);

          this.updateBulkAllocationValue(false);
          this.updateBotsTable();
          this.showSuccessDialog(botUpdationMessage);
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
  showSuccessDialog(botUpdationMessage: string) {
    const dialogRef = this.dialog.open(SuccessDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: 'none',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        title: 'Success',
        message: botUpdationMessage,
        confirmText: 'OK',
      },
    });
    dialogRef.afterClosed();
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
    if (value === true) {
      this.adminBotsList.forEach((value) => {
        if (value.isEditable === true) {
          this.onCancelUpdateBot(value.id);
        }
      });
      const adminBotIds = this.dataSource.data.map((item) => item.id);
      this.adminBotsList = this.adminBotsList.map((item) => {
        if (item.isEditable === true) {
          this.updateWithPreviousValue(item, item.id);
        }
        item.isSelect = adminBotIds.includes(item.id) ? value : false;
        return item;
      });
    } else {
      this.adminBotsList = this.adminBotsList.map((item) => ({
        ...item,
        isSelect: value,
      }));
    }

    this.selectAllBots.update(() => value);
    this.updateBotsTable();
    this.updateBulkAllocationValue(value);
  }

  onSelectBots(value: boolean, id: number) {
    this.adminBotsList = this.adminBotsList.map((item) => {
      item.isSelect = id === item.id ? value : item.isSelect;
      if (item.isEditable === true) {
        this.updateWithPreviousValue(item, item.id);
      }
      return item;
    });
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
    const bot = this.adminBotsList.find((item) => item.isEditable === true);
    if (bot) {
      this.updateWithPreviousValue(bot, bot.id);
    }
    const dialogRef = this.dialog.open(AssignApplicationsBotsDialog, {
      width: 'auto',
      minWidth: 'none',
      maxWidth: '50rem',
      minHeight: 'none',
      maxHeight: 'none',
      disableClose: true,
      data: {
        applications: this.adminApplications,
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result && Array.isArray(result) && result.length > 0) {
        const adminBot = this.adminBotsList.filter(
          (item) => item.isSelect === true
        );
        const allocationErrorMessage: AllocationErrorMessage[] = [];
        let alredyApplicationExistCount = 0;
        const botsRequest: BotRequest[] = [];
        const applications = this.adminApplications
          .filter((item) => result.includes(item.id))
          .map((item) => {
            return item;
          });
        for (let i = 0; i < applications.length; i++) {
          if (
            adminBot.filter((item) =>
              item.applicationIds.includes(applications[i].id)
            ).length === adminBot.length
          ) {
            ++alredyApplicationExistCount;
            allocationErrorMessage.push({
              id: applications[i].id,
              title: applications[i].name,
              message:
                'No allocation is needed for this application, as it is already present in all the bots.',
            });
          } else if (
            (applications[i].remainingLicenseCount || 0) < adminBot.length
          ) {
            allocationErrorMessage.push({
              id: applications[i].id,
              title: applications[i].name,
              message: `Only ${
                applications[i].remainingLicenseCount || 0
              } bots have been assigned, as no more licenses are available.`,
            });
          }
        }
        if (alredyApplicationExistCount === applications.length) {
          this.showErrorDialog('All bots has already selected applications');
          return;
        }
        for (let i = 0; i < adminBot.length; i++) {
          for (let k = 0; k < applications.length; k++) {
            if (
              (!adminBot[i].applicationIds.includes(applications[k].id) &&
                applications[k].remainingLicenseCount) ||
              0 > 0
            ) {
              adminBot[i].applicationIds.push(applications[k].id);
              applications[k].remainingLicenseCount =
                (applications[k].remainingLicenseCount || 0) - 1;
            }
          }
          botsRequest.push({
            id: adminBot[i].id,
            is_admin: adminBot[i].isAdmin,
            application_ids: adminBot[i].applicationIds,
          });
        }
        if (allocationErrorMessage.length > 0) {
          const botUpdationMessage = allocationErrorMessage
            .map((model) => `${model.title} : ${model.message}`)
            .join('<br>');
          this.callUpdateBotApi(botsRequest, botUpdationMessage);
        } else {
          this.callUpdateBotApi(botsRequest, 'All bots updated successfully');
        }
      }
    });
  }
}
