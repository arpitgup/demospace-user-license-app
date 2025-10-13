import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-user-details',
  imports: [
    MatCardModule,
    ReactiveFormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './user-details.component.html',
  styleUrl: './user-details.component.scss',
})
export class UserDetailsComponent {
  readonly demoNameController = new FormControl(
    'Agentspace (Product) Demo - 1145'
  );
  readonly userNameController = new FormControl('Jagtar Singh');
  readonly jobTitleController = new FormControl('Sales Representative');
  readonly employeeController = new FormControl('5888');
  readonly costController = new FormControl('602');
  readonly managerController = new FormControl('Brenda Lee');
  readonly managerTitleController = new FormControl('VP Sales');
  readonly demoEmailController = new FormControl(
    'jagtars-agentspace-demo-user@1987984870407.altostrat.com'
  );
}
