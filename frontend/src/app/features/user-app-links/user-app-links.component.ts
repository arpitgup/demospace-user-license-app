import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-user-app-links',
  imports: [MatIconModule,MatCardModule],
  templateUrl: './user-app-links.component.html',
  styleUrl: './user-app-links.component.scss',
})
export class UserAppLinksComponent {

  copyText(){
    
  }
}
