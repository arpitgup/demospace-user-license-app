// import { Component, inject, signal, ViewChild } from '@angular/core';
// import { TableLoaderComponent } from '../../../loaders/table-loader/table-loader.component';
// import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
// import { MatTableDataSource, MatTableModule } from '@angular/material/table';
// import { ReactiveFormsModule } from '@angular/forms';
// import { MatSort, MatSortModule } from '@angular/material/sort';
// import { ErrorMessage } from '../../../shared/components/error-message/error-message';
// import { AdminService } from '../../../core/services/admin.service';
// import { LoaderService } from '../../../core/services/loading.service';
// import { Application } from '../../../core/models/application.model';
// import { MatDialog } from '@angular/material/dialog';
// import { error } from 'console';

// @Component({
//   selector: 'app-admin-application-table',
//   imports: [
//     TableLoaderComponent,
//     MatPaginatorModule,
//     MatTableModule,
//     ReactiveFormsModule,
//     MatSortModule,
//     ErrorMessage,
//   ],
//   templateUrl: './admin-application-table.component.html',
//   styleUrl: './admin-application-table.component.scss',
// })
// export class AdminApplicationTableComponent {
//   readonly adminService = inject(AdminService);
//   public isLoading = signal(true);
//   readonly loadingService = inject(LoaderService);
//   dataSource = new MatTableDataSource<Application>([]);
//   public readonly pageSizeOptions: number[] = [5];
//   adminApplications: Application[] = [];
//   public readonly botsResponse = this.adminService.bots;
//   public readonly errorMessage = signal<string>('');
//   private dialog = inject(MatDialog);

//   @ViewChild(MatSort) set sort(sort: MatSort) {
//     if (sort) {
//       this.dataSource.sort = sort;
//     }
//   }

//   @ViewChild(MatPaginator) set paginator(value: MatPaginator) {
//     if (value) {
//       this.dataSource.paginator = value;
//     }
//   }

//   displayedColumns: string[] = [
//     'application',
//     'listedBy',
//     'listedDate',
//     'category',
//     'applicationId',
//     'status',
//     'action',
//   ];

//   ngOnInit(): void {
//     this.getAllAdminApplications();
//     this.listenSearchBotValues();
//   }

//   ngAfterViewInit() {
//     this.dataSource.sortingDataAccessor = (item, property) => {
//       switch (property) {
//         case 'applicationId':
//           return item.id;
//         case 'application':
//           return item.name;
//         default:
//           const value = item[property as keyof Application];
//           return typeof value === 'string' || typeof value === 'number'
//             ? value
//             : String(value);
//       }
//     };
//   }

//   getAllAdminBots() {
//     this.isLoading.set(true);
//     this.adminService.fetchAllApplications().subscribe({
//       next: (res) => {
//         this.adminApplications = res;
//         this.dataSource.data = this.adminApplications;
//         this.isLoading.set(false);
//       },
//       error: (error) => {
//         this.showErrorDialog(error?.error?.detail || 'Something went wrong');
//         this.isLoading.set(false);
//       },
//     });
//   }

//   updateApplicationAvailability(applications: Application[]) {
//     this.adminApplications = applications.map((element) => ({
//       ...element,
//       isEnabled: (element.isEnabled =
//         (element.licenseAssignedToBots ?? 0) < (element.licenseCount ?? 0)
//           ? true
//           : false),
//       remainingLicenseCount:
//         (element.licenseCount ?? 0) - (element.licenseAssignedToBots ?? 0),
//     }));
//   }

//   onEditBot(botId: number) {
//     this.dataSource.data = this.adminBotsList.map((item) => {
//       if (item.id === botId) {
//         item.isEditable = true;
//       } else {
//         item.isEditable = false;
//       }
//       return item;
//     });
//   }

//   onSaveBotDetails(botId: number) {
//     this.dataSource.data = this.adminBotsList.map((item) => {
//       if (item.id === botId) {
//         item.isEditable = false;
//       }
//       return item;
//     });
//     const adminBot = this.adminBotsList.filter((item) => item.id === botId);
//     this.updateBot(botId, adminBot[0]);
//   }

//   updateBot(botId: number, botResponse: AdminBotsResponse) {
//     this.loadingService.show();
//     const bots: BotRequest[] = [
//       {
//         id: botId,
//         is_admin: botResponse.isAdmin,
//         application_ids: botResponse.applicationIds,
//       },
//     ];
//     const botsRequest: UpdateBotRequest = {
//       bots: bots,
//     };
//     of(null)
//       .pipe(
//         concatMap(() =>
//           this.botsService
//             .updateBots(botsRequest)
//             .pipe(map((bots) => ({ bots })))
//         ),
//         concatMap((bots) =>
//           this.adminService
//             .fetchAllApplications()
//             .pipe(map((applications) => ({ ...bots, applications })))
//         )
//       )
//       .subscribe({
//         next: (res) => {
//           this.updateApplicationAvailability(res.applications);
//           const index = this.adminBotsList.findIndex(
//             (item) => item.id === botId
//           );
//           const adminBotResponse = res.bots.filter((item) => item.id === botId);
//           adminBotResponse[0].applicationIds = res.bots[0].applications.map(
//             (item) => item.id
//           );

//           this.adminBotsList.splice(index, 1, adminBotResponse[0]);
//           this.dataSource.data = this.adminBotsList;
//         },
//         error: (error) => {
//           this.showErrorDialog(error?.error?.detail || 'Something went wrong');
//         },
//         complete: () => {
//           this.loadingService.hide();
//         },
//       });
//   }

//   onCancelUpdateBot(botId: number) {
//     this.dataSource.data = this.adminBotsList.map((item) => {
//       if (item.id === botId) {
//         item.isEditable = false;
//       }
//       return item;
//     });
//   }

//   onSelectionChange(event: MatSelectChange, bot: AdminBotsResponse) {
//     if (event.value) {
//       const previousValue: number[] = this.adminBotsList.filter(
//         (item) => item.id === bot.id
//       )[0].applicationIds;
//       const currentValue: number[] = event.value;
//       const selectedValues = currentValue.filter(
//         (value) => !previousValue.includes(value)
//       );
//       const deselectedValues = previousValue.filter(
//         (value) => !currentValue.includes(value)
//       );
//       if (selectedValues.length > 0 || deselectedValues.length > 0) {
//         this.adminApplications = this.adminApplications.map((item) => {
//           if (selectedValues.includes(item.id)) {
//             item.licenseAssignedToBots = (item.licenseAssignedToBots ?? 0) + 1;
//           } else if (deselectedValues.includes(item.id)) {
//             item.licenseAssignedToBots = (item.licenseAssignedToBots ?? 0) - 1;
//           }
//           return item;
//         });
//       }
//       this.updateApplicationAvailability(this.adminApplications);
//       this.dataSource.data = this.adminBotsList.map((item) => {
//         if (item.id === bot.id) {
//           item.applicationIds = event.value;
//         }
//         return item;
//       });
//     }
//   }

//   onSelectAdminReserved(checked: boolean, botId: number) {
//     this.dataSource.data = this.adminBotsList.map((item) => {
//       if (item.id === botId) {
//         item.isAdmin = checked;
//       }
//       return item;
//     });
//   }

//   showErrorDialog(errorMessage: string) {
//     this.dialog.open(ErrorDialog, {
//       width: 'auto',
//       minWidth: '41.86rem',
//       maxWidth: 'none',
//       minHeight: 'none',
//       maxHeight: 'none',
//       disableClose: true,
//       data: {
//         message: errorMessage,
//       },
//     });
//   }

//   onRetryCall() {
//     this.getAllAdminBots();
//   }
// }
