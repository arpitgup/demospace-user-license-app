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
  selectedTimeSlot: NextAvailableSlots
): Application[] {
  if (
    (application.isSelected ?? false) === false &&
    secondaryApplications.filter((item) => item.isSelected === true).length >= 2
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
    secondaryApplications.filter((item) => item.isSelected === true).length >= 2
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
