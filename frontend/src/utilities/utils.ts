import { start } from 'repl';
import { Application } from '../app/core/models/application.model';
import { NextAvailableSlots } from '../app/core/models/availabilityByApplication.model';

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
  maxApplicationSelection:number
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
    secondaryApplications.filter((item) => item.isSelected === true).length >= maxApplicationSelection
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
  if (TIMEZONE_ABBREVIATIONS[timeZone]) {
    return TIMEZONE_ABBREVIATIONS[timeZone];
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  });
  const parts = formatter.formatToParts(date);
  return parts.find((p) => p.type === 'timeZoneName')?.value || timeZone;
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
  expandRanges.push({ start: new Date(), end: nextDayDateTime });
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

    const isDisabled = expandRanges.some(
      (range) => d > range.start && d < range.end
    );
    hours.push({ date: d, display, isDisabled });
  }
  const timeSlots = hours.filter((item) => !item.isDisabled);
  return timeSlots;
}
