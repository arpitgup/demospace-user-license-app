import { Component, signal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';

interface AppInstructions {
  id: number;
  title: string;
  image: '';
  isOpen: boolean;
}
@Component({
  selector: 'app-new-user',
  imports: [MatExpansionModule],
  templateUrl: './new-user.component.html',
  styleUrl: './new-user.component.scss',
})
export class NewUserComponent {
  readonly panelOpenState = signal(false);
  loginSteps: AppInstructions[] = [
    {
      id: 1,
      title: 'Select Agentspace Demo from go/demos',
      image: '',
      isOpen: false,
    },
    {
      id: 2,
      title: 'Create User Profile',
      image: '',
      isOpen: false,
    },
    {
      id: 3,
      title: 'Use Credentials to Login',
      image: '',
      isOpen: false,
    },
    {
      id: 4,
      title: 'Get artifacts for Demo Walkthrough',
      image: '',
      isOpen: false,
    },
  ];
}
