import { AbstractControl, ValidatorFn } from '@angular/forms';

/**
 * A custom validator for a form group that checks if the end date/time is after the start date/time
 * and meets a minimum duration.
 * @param minHoursGetter A function that returns the minimum required duration in hours.
 * @returns A ValidatorFn that returns an error map if validation fails, otherwise null.
 */
export function rangeValidator(minHoursGetter: () => number): ValidatorFn {
  return (group: AbstractControl) => {
    const sDate: Date | null = group.get('startDate')?.value ?? null;
    const sHour: number | null = group.get('startTime')?.value ?? null;
    const eDate: Date | null = group.get('endDate')?.value ?? null;
    const eHour: number | null = group.get('endTime')?.value ?? null;

    if (!sDate || sHour === null || !eDate || eHour === null) {
      return null;
    }

    const start = startOfHour(sDate, sHour);
    const end = startOfHour(eDate, eHour);

    if (end <= start) return { orderInvalid: true };

    const currentDateTime=new Date();
    if(currentDateTime>start)  return {invalidStartDateTime:true};
    
    const diffHours = (end.getTime() - start.getTime()) / 36e5;
    const min = minHoursGetter();

    if (diffHours < min) return { minDuration: { min } };
    if (Math.round(diffHours) !== diffHours) return { stepInvalid: true };
    return null;
  };
}

/** Creates a new Date object set to the beginning of a specific hour. */
export function startOfHour(date: Date, hour: number): Date {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Returns a new Date object with the specified number of hours added. */
export function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours, 0, 0, 0);
  return d;
}

/** Returns a new Date object set to the beginning of the day (midnight). */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Checks if two Date objects fall on the same year, month, and day. */
export function isSameYMD(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
