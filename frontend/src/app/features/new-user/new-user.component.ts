import { Component } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import {
  DEMO_PAGE_URL,
  MANAGE_PROFILE_INSTRUCTIONS_URL,
} from '../../shared/constants/links.contants';
import { AppInstructions } from '../../core/models/app-instructions.model';

@Component({
  selector: 'app-new-user',
  imports: [MatExpansionModule, MatIconModule],
  templateUrl: './new-user.component.html',
  styleUrl: './new-user.component.scss',
})
export class NewUserComponent {
  manageProfileLink = MANAGE_PROFILE_INSTRUCTIONS_URL;
  demoPageUrl = DEMO_PAGE_URL;
  loginSteps: AppInstructions[] = [
    {
      id: 1,
      title: `Click on “Launch Live Application” from the demo page on <a
          [href]="${DEMO_PAGE_URL}"
          target="_blank"
          rel="noopener noreferrer"
          >go/demos</a
        >.`,
      image: ['assets/images/godemosagentspacepage.png'],
      headerText: [],
      footerText: [],
      isOpen: false,
    },
    {
      id: 2,
      title: 'Welcome screen',
      image: ['assets/images/welcome.png'],
      headerText: [],
      footerText: [],
      isOpen: false,
    },
    {
      id: 3,
      title: 'Create user profile',
      image: ['assets/images/signup_user.png'],
      headerText: [],
      footerText: [],
      isOpen: false,
    },
    {
      id: 4,
      title: 'Use credentials to login',
      image: ['assets/images/demo_credentials.png'],
      headerText: [],
      footerText: [],
      isOpen: false,
    },
    {
      id: 5,
      title: 'Important links for demo',
      image: ['assets/images/drive_links.png'],
      headerText: [],
      footerText: [
        'NOTE: This is a sample image, your demo may have a different set of links.',
      ],
      isOpen: false,
    },
  ];
}
