import { Application } from '../app/core/models/application.model';
import { NextAvailableSlots } from '../app/core/models/availabilityByApplication.model';
import {
  TIME_SLOT_END_HOUR,
  TIME_SLOT_START_HOUR,
} from '../app/features/search-by-date/search-by-date.constants';
import { NormalizedReservation } from './interfaces/normalized_reservation';
import { TimeSlot } from './interfaces/time_slot';

export function getUniqueSecondaryApplications(
  nextAvailableSlots: NextAvailableSlots,
  primaryApplicationId: number
): Application[] {
  const uniqueApplications = new Map<number, Application>();
  nextAvailableSlots.availableBots?.forEach((availableBots) => {
    availableBots.applications?.forEach((application) => {
      if (
        !uniqueApplications.has(application.id) &&
        primaryApplicationId !== application.id
      ) {
        uniqueApplications.set(application.id, application);
      }
    });
  });
  return Array.from(uniqueApplications.values()).map((item) => ({
    ...item,
    isEnabled: true,
  }));
}

export function onApplicationSelected(
  application: Application,
  secondaryApplications: Application[],
  selectedTimeSlot: NextAvailableSlots,
  maxApplicationSelection: number
): Application[] {
  if (
    ((application.isSelected ?? false) === false &&
      secondaryApplications.filter((item) => item.isSelected === true).length >=
        maxApplicationSelection) ||
    application.isEnabled === false
  ) {
    return secondaryApplications;
  }
  const selectedSecondaryApplications = secondaryApplications.find(
    (item) => item.id === application.id
  );
  if (selectedSecondaryApplications) {
    selectedSecondaryApplications.isSelected = !(
      application.isSelected ?? false
    );
  }
  if (
    secondaryApplications.filter((item) => item.isSelected === true).length >=
    maxApplicationSelection
  ) {
    return secondaryApplications.map((item) => ({
      ...item,
      isEnabled: item.isSelected ? true : false,
    }));
  }
  const uniqueApplications = new Map<number, Application>();

  selectedTimeSlot?.availableBots?.forEach((availableBots) => {
    const selectedIds = secondaryApplications
      .filter((item) => item.isSelected === true)
      .map((item) => item.id);

    if (
      selectedIds.every((id) =>
        availableBots.applications?.some((item) => item.id == id)
      )
    ) {
      availableBots.applications?.forEach((application) => {
        if (!uniqueApplications.has(application.id)) {
          uniqueApplications.set(application.id, application);
        }
      });
    }
  });
  const availableApplications = Array.from(uniqueApplications.values());
  const availableIds = new Set(availableApplications.map((item) => item.id));
  return secondaryApplications.map((item) => ({
    ...item,
    isEnabled: availableIds.has(item.id),
  }));
}

export const TIMEZONE_ABBREVIATIONS: Record<string, string> = {
  // Asia
  'Asia/Kolkata': 'IST',
  'Asia/Calcutta': 'IST',
  'Asia/Dhaka': 'BST',
  'Asia/Karachi': 'PKT',
  'Asia/Kathmandu': 'NPT',
  'Asia/Dubai': 'GST',
  'Asia/Tokyo': 'JST',
  'Asia/Shanghai': 'CST',
  'Asia/Singapore': 'SGT',
  'Asia/Hong_Kong': 'HKT',
  'Asia/Seoul': 'KST',
  'Asia/Colombo': 'SLST',
  'Asia/Yangon': 'MMT',

  // Europe
  'Europe/London': 'GMT/BST',
  'Europe/Paris': 'CET/CEST',
  'Europe/Berlin': 'CET/CEST',
  'Europe/Madrid': 'CET/CEST',
  'Europe/Rome': 'CET/CEST',
  'Europe/Athens': 'EET/EEST',
  'Europe/Moscow': 'MSK',

  // North America
  'America/New_York': 'EST/EDT',
  'America/Chicago': 'CST/CDT',
  'America/Denver': 'MST/MDT',
  'America/Los_Angeles': 'PST/PDT',
  'America/Phoenix': 'MST', // no DST
  'America/Anchorage': 'AKST/AKDT',
  'America/Halifax': 'AST/ADT',
  'America/Toronto': 'EST/EDT',
  'America/Vancouver': 'PST/PDT',
  'America/Mexico_City': 'CST/CDT',

  // South America
  'America/Sao_Paulo': 'BRT/BRST',
  'America/Argentina/Buenos_Aires': 'ART',
  'America/Lima': 'PET',
  'America/Bogota': 'COT',
  'America/Caracas': 'VET',

  // Africa
  'Africa/Cairo': 'EET',
  'Africa/Johannesburg': 'SAST',
  'Africa/Nairobi': 'EAT',
  'Africa/Lagos': 'WAT',
  'Africa/Casablanca': 'WET/WEST',

  // Australia & Pacific
  'Australia/Sydney': 'AEST/AEDT',
  'Australia/Melbourne': 'AEST/AEDT',
  'Australia/Perth': 'AWST',
  'Australia/Brisbane': 'AEST', // no DST
  'Pacific/Auckland': 'NZST/NZDT',
  'Pacific/Fiji': 'FJT',
  'Pacific/Honolulu': 'HST',

  // Default (fallback)
  UTC: 'UTC',
};

export function getLocalTimeZoneAbbreviation(
  date: Date,
  timeZone: string
): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(date);
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value;
    return tz?.includes('GMT')
      ? `${TIMEZONE_ABBREVIATIONS[timeZone]} (${getGMTOffset(date, timeZone)})`
      : `${tz ?? TIMEZONE_ABBREVIATIONS[timeZone]} (${getGMTOffset(
          date,
          timeZone
        )})`;
  } catch  {
    return getGMTOffset(date, timeZone);
  }
}

export function getGMTOffset(date: Date, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    hour12: false,
    timeZoneName: 'longOffset',
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);
  return (
    parts.find((p) => p.type === 'timeZoneName')?.value ||
    TIMEZONE_ABBREVIATIONS[timeZone]
  );
}

export function generateHoursList(
  day: Date,
  disabledRanges: NormalizedReservation[],
  blockTimePeriod: number,
  initialDuration: number,
  nextDayDateTime: Date
): TimeSlot[] {
  const hours: TimeSlot[] = [];
  const expandRanges = disabledRanges.map((r) => ({
    start: new Date(r.start.getTime() - initialDuration * 60 * 60 * 1000),
    end: new Date(r.end.getTime() + blockTimePeriod * 60 * 60 * 1000),
  }));
  const startDateTime = new Date();
  startDateTime.setHours(0, 0, 0, 0);
  expandRanges.push({ start: startDateTime, end: nextDayDateTime });
  for (let i = 0; i < 24; i++) {
    const d = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      i,
      0,
      0,
      0
    );

    const display = d.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    if (isSameDay(d, nextDayDateTime) && d.getHours() === 0) {
      const isDisabled = expandRanges.some(
        (range) => d >= range.start && d < range.end
      );
      hours.push({ date: d, display, isDisabled });
    } else {
      const isDisabled = expandRanges.some(
        (range) => d > range.start && d < range.end
      );
      hours.push({ date: d, display, isDisabled });
    }
  }
  const timeSlots = hours.filter(
    (item) =>
      !item.isDisabled &&
      item.date.getHours() >= TIME_SLOT_START_HOUR &&
      item.date.getHours() <= TIME_SLOT_END_HOUR
  );
  return timeSlots;
}

function isSameDay(selectedDate: Date, endDate: Date): boolean {
  return (
    selectedDate.getDate() === endDate.getDate() &&
    selectedDate.getMonth() === endDate.getMonth() &&
    selectedDate.getFullYear() === endDate.getFullYear()
  );
}
