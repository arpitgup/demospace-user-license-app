import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { start } from 'repl';

@Component({
  selector: 'app-search-application',
  providers: [provideNativeDateAdapter()],
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatIconModule,
    MatTimepickerModule,
    MatGridListModule,
    MatDividerModule,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-application.html',
  styleUrl: './search-application.scss',
})
export class SearchApplicationComponent implements OnInit {
  options = [
    { value: 'box', viewValue: 'Box' },
    { value: 'sharepoint', viewValue: 'Sharepoint' },
    { value: 'salesforce', viewValue: 'Salesforce' },
    { value: 'jira', viewValue: 'Jira' },
    { value: 'office365', viewValue: 'Office365' },
  ];

  durations = [
    { value: '2hours', viewValue: '2 Hours' },
    { value: '4hours', viewValue: '4 Hours' },
    { value: '8hours', viewValue: '8 Hours' },
    { value: '12hours', viewValue: '12 Hours' },
    { value: '24hours', viewValue: '24 Hours' },
    { value: '48hours', viewValue: '48 Hours' },
  ];

  applications = [
    { name: 'Service now', isSelected: false },
    { name: 'Box', isSelected: true },
    { name: 'Office 365', isSelected: false },
    { name: 'Sharepoint', isSelected: false },
    { name: 'Confluence', isSelected: false },
    { name: 'Jira', isSelected: false },
  ];

  items = [
    { date: 'Aug 7', time: '10 am to 6 pm', isSelected: false },
    { date: 'Aug 7', time: '12 am to 8 pm', isSelected: true },
    { date: 'Aug 7', time: '2 am to 10 pm', isSelected: false },
    { date: 'Aug 7 - Aug 8', time: '10 am to 10 pm', isSelected: false },
  ];

  slots = [
    { date: '08/02/2025', time: '8:am - 2:00pm', isSelected: true },
    { date: '08/02/2025', time: '10:am - 4:00pm', isSelected: false },
  ];

  onApplicationClicked(application: any) {
    console.log('called');
  }

  formInvalid = true;
  minDate: Date;
  maxDate: Date;
  minAllowedTime: string;
  maxAllowedTime: string;
  applicationForm: FormGroup;
  nextHour: number;
  constructor(private fb: FormBuilder) {
    const today = new Date();
    this.minDate = new Date(today);
    this.minDate.setDate(today.getDate() + 1);

    this.maxDate = new Date(today);
    this.maxDate.setDate(today.getDate() + 30);
    this.minAllowedTime = '08:00';
    const now = new Date();
    this.nextHour = (now.getHours() + 1) % 24;
    this.maxAllowedTime = '23:00';

    this.applicationForm = this.fb.group({
      selectedApplication: ['', Validators.required],
      startDate: ['', Validators.required],
      startTime: ['', Validators.required],
      selectedDuration: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.applicationForm
      .get('startDate')
      ?.valueChanges.subscribe((newValue) => {
        const startDateTime = new Date(newValue as Date);
        if (
          newValue.getFullYear() === this.minDate.getFullYear() &&
          newValue.getDate() === this.minDate.getDate() &&
          this.minDate.getMonth() === newValue.getMonth()
        ) {
          this.minAllowedTime =
            this.nextHour < 8
              ? '08:00'
              : this.nextHour.toString().padStart(2, '0') + ':00';
          const selectedHour =
            this.applicationForm.get('startTime')?.value?.getHours ?? 0;
          if (selectedHour >= this.nextHour) {
            return;
          }
          startDateTime.setHours(this.nextHour < 8 ? 8 : this.nextHour, 0, 0);
          this.applicationForm.get('startTime')?.patchValue(startDateTime);
        } else {
          if (
            this.applicationForm.get('startTime')?.value?.getHours ??
            0 != 0
          ) {
            return;
          }
          this.minAllowedTime = '08:00';
          startDateTime.setHours(8, 0, 0);
          this.applicationForm.get('startTime')?.patchValue(startDateTime);
        }
        this.applicationForm.get('startTime')?.markAllAsTouched();
        this.applicationForm.get('startTime')?.markAllAsDirty();
      });
  }
  checkAvailability() {
    console.log('Booking confirmed!', this.applicationForm.value);
  }
}
