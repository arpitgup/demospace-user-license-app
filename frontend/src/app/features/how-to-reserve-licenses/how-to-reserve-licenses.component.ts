import { Component, Input } from '@angular/core';
import {
  DEMO_PAGE_URL,
  MANAGE_PROFILE_INSTRUCTIONS_URL,
  RELEASE_NOTES_LINK,
} from '../../shared/constants/links.contants';
import { AppInstructions } from '../../core/models/app-instructions.model';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { DemoDetails } from '../../core/models/demo-details.model';

@Component({
  selector: 'app-how-to-reserve-licenses',
  imports: [MatIconModule, MatExpansionModule],
  templateUrl: './how-to-reserve-licenses.component.html',
  styleUrl: './how-to-reserve-licenses.component.scss',
})
export class HowToReserveLicensesComponent {
  @Input() demoDetails!: DemoDetails;
  manageProfileLink = MANAGE_PROFILE_INSTRUCTIONS_URL;
  releaseNotesLink = RELEASE_NOTES_LINK;
  goDemoUrl = DEMO_PAGE_URL;
  reserveByDate: AppInstructions[] = [
    {
      id: 1,
      title:
        '1. Scroll to the bottom on the user app and click on Search By Date',
      image: ['assets/images/license_home.png'],
      headerText: [],
      footerText: [],
      isOpen: false,
    },
    {
      id: 2,
      title:
        "2. Select Date, start and end time, then click on 'Check Availability'",
      image: ['assets/images/select_date_range.png'],
      headerText: [
        'Reservation can be for up to 72 hours and 30 days in advance.',
      ],
      footerText: [],
      isOpen: false,
    },
    {
      id: 3,
      title:
        '3. Select up to 3 Applications and click on “Confirm Reservation”',
      image: ['assets/images/select_data_app.png'],
      headerText: [
        'Confirm date and time is correct based on your current system timezone. This application does not allow overlapping reservations.',
      ],
      footerText: [],
      isOpen: false,
    },
  ];

  reserveByApplication: AppInstructions[] = [
    {
      id: 1,
      title:
        '1. Scroll to the bottom on the user app and click on Search By Application',
      image: ['assets/images/license_home.png'],
      headerText: [],
      footerText: [],
      isOpen: false,
    },
    {
      id: 2,
      title:
        "2. Select Primary Application, start date, start time and duration, then click on 'Check Availability'",
      image: ['assets/images/search_by_app_date.png'],
      headerText: [
        '“Primary Application” is the application you need the most for your demo.',
        'Reservation can be for up to 72 hours and 30 days in advance.',
      ],
      footerText: [],
      isOpen: false,
    },
    {
      id: 3,
      title:
        '3.[OPTIONAL] Select up to 2 additional applications and click on “Confirm Reservation”.',
      image: ['assets/images/search_by_app_date_app.png'],
      headerText: [
        'System looked up availability of our “Primary Application” and is now offering the option to add up to TWO additional applications to your reservation.',
      ],
      footerText: [],
      isOpen: false,
    },
  ];

  confirmReservation: AppInstructions[] = [
    {
      id: 1,
      title: '1. Validate and click on “Confirm” to complete your reservation',
      image: ['assets/images/are_you_sure.png', 'assets/images/success.png'],
      headerText: [
        'Validate Applications, start and end date and time. Pay attention to the timezone derived from your system time.',
        ' Confirmation Screens:',
      ],
      footerText: [],
      isOpen: false,
    },
    {
      id: 2,
      title: "2. Log into your Demo User's gmail inbox",
      image: ['assets/images/email_confirmation.png'],
      headerText: [],
      footerText: [
        ' Sample Email sent to <ldap>-agentspace-demo-user@1987984870407.altostrat.com',
      ],
      isOpen: false,
    },
  ];
}
