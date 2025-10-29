import { Component } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MANAGE_PROFILE_INSTRUCTIONS_URL } from '../../shared/constants/links.contants';

interface AppInstructions {
  id: number;
  title: string;
  image: string;
  isOpen: boolean;
}
@Component({
  selector: 'app-new-user',
  imports: [MatExpansionModule,MatIconModule],
  templateUrl: './new-user.component.html',
  styleUrl: './new-user.component.scss',
})
export class NewUserComponent {

  manageProfileLink=MANAGE_PROFILE_INSTRUCTIONS_URL;
  loginSteps: AppInstructions[] = [
    {
      id: 1,
      title: 'Select Agentspace Demo from go/demos',
      image: 'assets/images/godemosagentspacepage.png',
      isOpen: false,
    },
    {
      id: 2,
      title: 'Create User Profile',
      image: 'assets/images/signup_user.png',
      isOpen: false,
    },
    {
      id: 3,
      title: 'Use Credentials to Login',
      image: 'assets/images/demo_credentials.png',
      isOpen: false,
    },
    {
      id: 4,
      title: 'Get artifacts for Demo Walkthrough',
      image: 'assets/images/drive_links.png',
      isOpen: false,
    },
  ];
}
