import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timezoneAbbr',
  standalone: true,
})
export class TimezoneAbbrPipe implements PipeTransform {
  transform(value: Date | string | null): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    return (
      Intl.DateTimeFormat('en-IN', { timeZoneName: 'short' })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')?.value ?? ''
    );
  }
}
