import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoaderService } from '../../../../core/services/loader.service';

@Component({
  selector: 'app-common-loader',
  standalone:true,
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './common-loader.html',
  styleUrl: './common-loader.scss'
})
export class CommonLoader {
  loaderService=inject(LoaderService);
}
