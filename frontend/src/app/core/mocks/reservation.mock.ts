import { BehaviorSubject, delay, of } from 'rxjs';
import { BotWithApps, Reservation } from '../models/reservation.model';
import { AppConfig } from '../models/appConfig.model';
import { signal } from '@angular/core';
import { Application } from '../models/application.model';
import { AvalaibilityByApplication } from '../models/availability-by-application.model';
import { MakeReservationResponse } from '../models/make-reservation-response.model';

export const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: 1,
    userEmail: 'some.user@google.com',
    bot: {
      id: 1,
      name: 'Bot1',
      email: 'bot1@example.com',
    },
    applications: [
      {
        id: 101,
        name: 'ServiceNow',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 102,
        name: 'Slack',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 103,
        name: 'Jira',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-07-29T00:00:00Z',
    endTime: '2025-08-01T23:59:59Z',
    status: 'APPROVED',
  },
  {
    id: 2,
    userEmail: 'some.user@google.com',
    bot: {
      id: 2,
      name: 'Bot7',
      email: 'bot7@example.com',
    },
    applications: [
      {
        id: 102,
        name: 'Slack',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-08-11T00:00:00Z',
    endTime: '2025-08-13T23:59:59Z',
    status: 'PENDING',
  },
  {
    id: 3,
    userEmail: 'some.user@google.com',
    bot: {
      id: 3,
      name: 'Bot3',
      email: 'bot3@example.com',
    },
    applications: [
      {
        id: 103,
        name: 'Jira',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 104,
        name: 'Confluence',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-07-15T00:00:00Z',
    endTime: '2025-07-20T23:59:59Z',
    status: 'COMPLETED',
  },
  {
    id: 4,
    userEmail: 'some.user@google.com',
    bot: {
      id: 4,
      name: 'Bot2',
      email: 'bot2@example.com',
    },
    applications: [
      {
        id: 105,
        name: 'Salesforce',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 106,
        name: 'Outlook',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-09-01T00:00:00Z',
    endTime: '2025-09-05T23:59:59Z',
    status: 'PENDING',
  },
  {
    id: 5,
    userEmail: 'some.user@google.com',
    bot: {
      id: 5,
      name: 'Bot4',
      email: 'bot4@example.com',
    },
    applications: [
      {
        id: 107,
        name: 'Zendesk',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 102,
        name: 'Slack',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-10-10T00:00:00Z',
    endTime: '2025-10-15T23:59:59Z',
    status: 'PENDING',
  },
  {
    id: 6,
    userEmail: 'some.user@google.com',
    bot: {
      id: 6,
      name: 'Bot5',
      email: 'bot5@example.com',
    },
    applications: [
      {
        id: 108,
        name: 'HubSpot',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-11-05T00:00:00Z',
    endTime: '2025-11-10T23:59:59Z',
    status: 'PENDING',
  },
  {
    id: 7,
    userEmail: 'some.user@google.com',
    bot: {
      id: 7,
      name: 'Bot6',
      email: 'bot6@example.com',
    },
    applications: [
      {
        id: 109,
        name: 'Asana',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 103,
        name: 'Jira',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 102,
        name: 'Slack',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-12-01T00:00:00Z',
    endTime: '2025-12-07T23:59:59Z',
    status: 'PENDING',
  },
  {
    id: 8,
    userEmail: 'some.user@google.com',
    bot: {
      id: 8,
      name: 'Bot8',
      email: 'bot8@example.com',
    },
    applications: [
      {
        id: 110,
        name: 'Trello',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2026-01-20T00:00:00Z',
    endTime: '2026-01-25T23:59:59Z',
    status: 'PENDING',
  },
  {
    id: 9,
    userEmail: 'some.user@google.com',
    bot: {
      id: 9,
      name: 'Bot9',
      email: 'bot9@example.com',
    },
    applications: [
      {
        id: 111,
        name: 'GitHub',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 112,
        name: 'GitLab',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-06-10T00:00:00Z',
    endTime: '2025-06-15T23:59:59Z',
    status: 'COMPLETED',
  },
  {
    id: 10,
    userEmail: 'some.user@google.com',
    bot: {
      id: 10,
      name: 'Bot10',
      email: 'bot10@example.com',
    },
    applications: [
      {
        id: 113,
        name: 'Figma',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 114,
        name: 'Sketch',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-05-01T00:00:00Z',
    endTime: '2025-05-07T23:59:59Z',
    status: 'COMPLETED',
  },
];

export const mockReservationService = {
  reservations: signal<Reservation[]>([]),
  appConfigData: signal<AppConfig | null>(null),
  fetchReservations: () => of([]),
  getApplications: () => of([]),
  getConfig: () =>
    of({
      rollingWindowHours: 1,
      maxCalendarDays: 30,
      maxReservationApplications: 3,
      reservationCoolOffHours: 1,
    }),
  checkBotsAvailabilityByDate: () => of({ availableBots: [] }),
  createReservation: () => of({} as Reservation),
  application$: () => of(application$),
  checkAvailabilityByApplication: () =>
    of({} as AvalaibilityByApplication).pipe(delay(2000)),
  callMakeReservation: () => of({} as MakeReservationResponse),
};

export const mockMatDialog = {
  open: () => ({
    afterClosed: () => of(true),
  }),
};

export enum ReservationApiStatus {
  PENDING = 'Pending',
  ACTIVE = 'Active',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export const mockAppConfig: AppConfig = {
  maxReservationApplications: 3,
  maxCalendarDays: 30,
  rollingWindowHours: 1,
  reservationLeadDays: 7,
  unavailableReservationDays: 7,
  maxSlotsToFind: 3,
  reservationCoolOffHours:1,
};

export const mockAvailableBots: BotWithApps = {
  id: 1,
  name: 'demo.user1',
  email: 'demo.altostrat.com',
  applications: [],
};

export const mockApplication: Application[] = [
  {
    id: 4,
    name: 'Box',
    isActive: true,
    isSelected: false,
    isEnabled: true,
  },
  {
    id: 5,
    name: 'Sharepoint',
    isActive: true,
    isSelected: false,
    isEnabled: true,
  },
  {
    id: 6,
    name: 'JIRA',
    isActive: true,
    isSelected: false,
    isEnabled: true,
  },
  {
    id: 7,
    name: 'Confluence',
    isActive: true,
    isSelected: false,
    isEnabled: true,
  },
  {
    id: 8,
    name: 'Office365',
    isActive: true,
    isSelected: false,
    isEnabled: true,
  },
];

export const application$: BehaviorSubject<Application[]> = new BehaviorSubject<
  Application[]
>(mockApplication);

export const mockSearchApplicationReservation: Reservation[] = [
  {
    id: 1,
    userEmail: 'some.user@google.com',
    bot: {
      id: 1,
      name: 'Bot1',
      email: 'bot1@example.com',
    },
    applications: [
      {
        id: 101,
        name: 'ServiceNow',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 102,
        name: 'Slack',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 103,
        name: 'Jira',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-08-29T00:00:00Z',
    endTime: '2025-08-30T23:59:59Z',
    status: 'PENDING',
  },
  {
    id: 2,
    userEmail: 'some.user@google.com',
    bot: {
      id: 2,
      name: 'Bot7',
      email: 'bot7@example.com',
    },
    applications: [
      {
        id: 102,
        name: 'Slack',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-08-25T02:30:00Z',
    endTime: '2025-08-25T04:30:00Z',
    status: 'ACTIVE',
  },
  {
    id: 3,
    userEmail: 'some.user@google.com',
    bot: {
      id: 3,
      name: 'Bot3',
      email: 'bot3@example.com',
    },
    applications: [
      {
        id: 103,
        name: 'Jira',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
      {
        id: 104,
        name: 'Confluence',
        isSelected: false,
        isEnabled: false,
        isActive: true,
      },
    ],
    startTime: '2025-08-23T11:00:00Z',
    endTime: '2025-08-23T16:00:00Z',
    status: 'PENDING',
  },
];

export const mockCheckAvailaibilityByApplication: AvalaibilityByApplication = {
  requestedSlotAvailable: true,
  nextAvailableSlots: [
    {
      startTime: '2025-09-01T08:00:00Z',
      endTime: '2025-09-01T10:00:00Z',
      availableBots: [
        {
          id: '1',
          name: 'demo.user1',
          email: 'demo.user1@1987984870407.altostrat.com',
          applications: [
            {
              id: 4,
              name: 'Box',
              isActive: true,
              isEnabled: true,
              isSelected: false,
            },
            {
              id: 5,
              name: 'Sharepoint',
              isActive: true,
              isEnabled: true,
              isSelected: false,
            },
            {
              id: 3,
              name: 'ServiceNow',
              isActive: true,
              isEnabled: true,
              isSelected: false,
            },
          ],
        },
        {
          id: '5',
          name: 'demo.user5',
          email: 'demo.user5@1987984870407.altostrat.com',
          applications: [
            {
              id: 4,
              name: 'Box',
              isActive: true,
              isEnabled: true,
              isSelected: false,
            },
            {
              id: 5,
              name: 'Sharepoint',
              isActive: true,
              isEnabled: true,
              isSelected: false,
            },
            {
              id: 8,
              name: 'Office365',
              isActive: true,
              isEnabled: true,
              isSelected: false,
            },
            {
              id: 3,
              name: 'ServiceNow',
              isActive: true,
              isEnabled: true,
              isSelected: false,
            },
          ],
        },
      ],
    },
  ],
};

export const makeReservationMock: MakeReservationResponse = {
  id: 176,
  userEmail: 'jagtars@1987984870407.altostrat.com',
  bot: {
    id: 1,
    name: 'demo.user1',
    email: 'demo.user1@1987984870407.altostrat.com',
  },
  applications: [
    {
      id: 4,
      name: 'Box',
      isActive: true,
      isSelected: false,
      isEnabled: true,
    },
  ],
  startTime: '2025-08-29T08:00:00Z',
  endTime: '2025-08-30T08:00:00Z',
};
