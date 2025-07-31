import { Reservation } from '../models/reservation.model';

export const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    userId: 'some.user@google.com',
    assignedBotId: 'Bot1',
    primaryApplicationId: 'ServiceNow',
    additionalApplicationIds: ['Slack', 'Jira'],
    startDate: '2025-07-29T00:00:00Z', // Current
    endDate: '2025-08-01T23:59:59Z',
    createdAt: '2025-07-20T10:00:00Z',
    provisioned: true,
    deprovisioned: false,
  },
  {
    id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    userId: 'some.user@google.com',
    assignedBotId: 'Bot7',
    primaryApplicationId: 'slack',
    additionalApplicationIds: [],
    startDate: '2025-08-11T00:00:00Z', // Upcoming
    endDate: '2025-08-13T23:59:59Z',
    createdAt: '2025-07-20T10:00:00Z',
    provisioned: false,
    deprovisioned: false,
  },
  {
    id: 'f1g2h3i4-j5k6-7890-1234-lmn5opq6r7s8',
    userId: 'some.user@google.com',
    assignedBotId: 'Bot3',
    primaryApplicationId: 'Jira',
    additionalApplicationIds: ['Confluence'],
    startDate: '2025-07-15T00:00:00Z', // Past
    endDate: '2025-07-20T23:59:59Z',
    createdAt: '2025-07-10T10:00:00Z',
    provisioned: true,
    deprovisioned: true,
  },
  {
    id: 'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
    userId: 'some.user@google.com',
    assignedBotId: 'Bot2',
    primaryApplicationId: 'Salesforce',
    additionalApplicationIds: ['Outlook'],
    startDate: '2025-09-01T00:00:00Z', // Upcoming
    endDate: '2025-09-05T23:59:59Z',
    createdAt: '2025-08-15T11:00:00Z',
    provisioned: false,
    deprovisioned: false,
  },
  {
    id: 'c3d4e5f6-a7b8-9012-3456-7890abcdef23',
    userId: 'some.user@google.com',
    assignedBotId: 'Bot4',
    primaryApplicationId: 'Zendesk',
    additionalApplicationIds: ['Slack'],
    startDate: '2025-10-10T00:00:00Z', // Upcoming
    endDate: '2025-10-15T23:59:59Z',
    createdAt: '2025-09-20T12:00:00Z',
    provisioned: false,
    deprovisioned: false,
  },
  {
    id: 'd4e5f6a7-b8c9-0123-4567-890abcdef345',
    userId: 'some.user@google.com',
    assignedBotId: 'Bot5',
    primaryApplicationId: 'HubSpot',
    additionalApplicationIds: [],
    startDate: '2025-11-05T00:00:00Z', // Upcoming
    endDate: '2025-11-10T23:59:59Z',
    createdAt: '2025-10-18T14:30:00Z',
    provisioned: false,
    deprovisioned: false,
  },
    {
    id: 'e5f6a7b8-c9d0-1234-5678-90abcdef4567',
    userId: 'some.user@google.com',
    assignedBotId: 'Bot6',
    primaryApplicationId: 'Asana',
    additionalApplicationIds: ['Jira', 'Slack'],
    startDate: '2025-12-01T00:00:00Z', // Upcoming
    endDate: '2025-12-07T23:59:59Z',
    createdAt: '2025-11-20T16:00:00Z',
    provisioned: false,
    deprovisioned: false,
  },
  {
    id: 'f6a7b8c9-d0e1-2345-6789-0abcdef56789',
    userId: 'some.user@google.com',
    assignedBotId: 'Bot8',
    primaryApplicationId: 'Trello',
    additionalApplicationIds: [],
    startDate: '2026-01-20T00:00:00Z', // Upcoming
    endDate: '2026-01-25T23:59:59Z',
    createdAt: '2025-12-15T09:00:00Z',
    provisioned: false,
    deprovisioned: false,
  },
  {
    id: '98765432-10fe-dcba-9876-543210fedcba',
    userId: 'some.user@google.com',
    assignedBotId: 'Bot9',
    primaryApplicationId: 'GitHub',
    additionalApplicationIds: ['GitLab'],
    startDate: '2025-06-10T00:00:00Z', // Past
    endDate: '2025-06-15T23:59:59Z',
    createdAt: '2025-06-01T10:00:00Z',
    provisioned: true,
    deprovisioned: true,
  },
  {
    id: '1234abcd-efgh-5678-ijkl-90mnopqrst',
    userId: 'some.user@google.com',
    assignedBotId: 'Bot10',
    primaryApplicationId: 'Figma',
    additionalApplicationIds: ['Sketch'],
    startDate: '2025-05-01T00:00:00Z', // Past
    endDate: '2025-05-07T23:59:59Z',
    createdAt: '2025-04-25T14:00:00Z',
    provisioned: true,
    deprovisioned: true,
  },
];
