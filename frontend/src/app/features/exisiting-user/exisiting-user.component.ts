import { Component } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MANAGE_PROFILE_INSTRUCTIONS_URL } from '../../shared/constants/links.contants';
import { MatIconModule } from '@angular/material/icon';
import { AppInstructions } from '../../core/models/app-instructions.model';



@Component({
  selector: 'app-exisiting-user',
  imports: [MatExpansionModule, MatIconModule],
  templateUrl: './exisiting-user.component.html',
  styleUrl: './exisiting-user.component.scss',
})
export class ExisitingUserComponent {
 
  manageProfileLink = MANAGE_PROFILE_INSTRUCTIONS_URL;
  loginSteps: AppInstructions[] = [
    {
      id: 1,
      title: 'Select Gemini Enterprise Demo from go/demos',
      image: ['assets/images/godemosagentspacepage.png'],
      headerText:[],
      footerText:[],
      isOpen: false,
    },
    {
      id: 2,
      title: 'Access same Sample Gemini Enterprise Demo',
      image: ['assets/images/new_user_app.png'],
      headerText:[],
      footerText:[],
      isOpen: false,
    },
    {
      id: 3,
      title: 'Access new Gemini Enterprise Demo',
      image:[ 'assets/images/new_user_app.png'],
      headerText:[],
      footerText:[],
      isOpen: false,
    },
    {
      id: 4,
      title: 'Reset Password (Optional)',
      image: ['assets/images/demo_credentials.png'],
      headerText:[],
      footerText:[],
      isOpen: false,
    },
    {
      id: 4,
      title: 'Get artifacts for Demo Walkthrough',
      image: ['assets/images/drive_links.png'],
      headerText:[],
      footerText:[],
      isOpen: false,
    },
  ];
}
