import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-error-message',
  imports: [MatIcon],
  templateUrl: './error-message.html',
  styleUrl: './error-message.scss',
})
export class ErrorMessage {
  @Input() errorMessage: string = '';
  @Output() retryClicked = new EventEmitter();

  onRetryCall() {
    this.retryClicked.emit();
  }
}
