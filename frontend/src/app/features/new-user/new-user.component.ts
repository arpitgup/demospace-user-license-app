import { Component } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import {
  CHAT_SPACE_URL,
  DEMO_PAGE_URL,
  DEMOSPACEINFO_LINK,
  MANAGE_PROFILE_INSTRUCTIONS_URL,
} from '../../shared/constants/links.contants';
import { AppInstructions } from '../../core/models/app-instructions.model';

export interface CarouselSlide {
  id: number;
  title: string;
  image: string;
  note?: string;
}

@Component({
  selector: 'app-new-user',
  imports: [MatExpansionModule, MatIconModule],
  templateUrl: './new-user.component.html',
  styleUrl: './new-user.component.scss',
})
export class NewUserComponent {
  manageProfileLink = MANAGE_PROFILE_INSTRUCTIONS_URL;
  demoPageUrl = DEMO_PAGE_URL;
  chatSpaceUrl = CHAT_SPACE_URL;
  demoSpaceInfoLink = DEMOSPACEINFO_LINK;
  geAppLinkImage = 'assets/images/ge_app_link.png';
  geAppErrorImage = 'assets/images/ge_app_error.png';

  currentMacWindowsSlide = 0;
  currentChromebookSlide = 0;

  macWindowsSlides: CarouselSlide[] = [
    {
      id: 1,
      title: '1. Copy the GE app link',
      image: 'assets/images/ge_app_link.png',
    },
    {
      id: 2,
      title:
        '2. Select “Work” profile from top right of Chrome browser. Select the profile you created under the “Other Chrome Profiles” section, e.g., {First Name} (Neuravibe). This should open a new browser with your demo credentials.',
      image: 'assets/images/profile_ios.png',
    },
    {
      id: 3,
      title:
        '3. Paste the GE APP Link. Save this location as a bookmark (Command + d / Ctrl + d). Going forward you can now access demos by selecting your new profile.',
      image: 'assets/images/new_demo_user_profile.png',
      note: 'NOTE: This is a sample image. Your application may look different according to your demo.',
    },
    {
      id: 4,
      title:
        '4. If applicable, open the demo drive link provided in your demo user’s profile.',
      image: 'assets/images/new_gmail_drive.png',
      note: 'NOTE: This is a sample image. Your application may look different according to your demo.',
    },
  ];

  chromebookSlides: CarouselSlide[] = [
    {
      id: 1,
      title: '1. Copy the GE app link',
      image: 'assets/images/ge_app_link.png',
    },
    {
      id: 2,
      title:
        "2. Open a new browser window and paste the GE app link. If you see a 403 error, it's most likely because Chrome takes a default account (ldap@google.com) to login. In such a case, select the profile icon in the bottom left corner and select your demo user login credentials as shown in the picture below.",
      image: 'assets/images/ge_app_error.png',
    },
    {
      id: 3,
      title:
        '3. Now Access demo app. Save this location as a bookmark (Ctrl + d / Command + d). (Note: you might want to create a designated folder for this as well to manage your “Accounts”). Going forward you can simply select the bookmark to access your demo.',
      image: 'assets/images/new_demo_user_profile.png',
      note: 'NOTE: This is a sample image. Your application may look different according to your demo.',
    },
    {
      id: 4,
      title:
        '4. If applicable, open the demo drive link provided in your demo user’s profile.',
      image: 'assets/images/new_gmail_drive.png',
      note: 'NOTE: This is a sample image. Your application may look different according to your demo.',
    },
  ];

  nextMacWindowsSlide(): void {
    if (this.currentMacWindowsSlide < this.macWindowsSlides.length - 1) {
      this.currentMacWindowsSlide++;
    } else {
      this.currentMacWindowsSlide = 0;
    }
  }

  prevMacWindowsSlide(): void {
    if (this.currentMacWindowsSlide > 0) {
      this.currentMacWindowsSlide--;
    } else {
      this.currentMacWindowsSlide = this.macWindowsSlides.length - 1;
    }
  }

  goToMacWindowsSlide(index: number): void {
    this.currentMacWindowsSlide = index;
  }

  nextChromebookSlide(): void {
    if (this.currentChromebookSlide < this.chromebookSlides.length - 1) {
      this.currentChromebookSlide++;
    } else {
      this.currentChromebookSlide = 0;
    }
  }

  prevChromebookSlide(): void {
    if (this.currentChromebookSlide > 0) {
      this.currentChromebookSlide--;
    } else {
      this.currentChromebookSlide = this.chromebookSlides.length - 1;
    }
  }

  goToChromebookSlide(index: number): void {
    this.currentChromebookSlide = index;
  }
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
