
export interface MakeReservationRequest{
    primaryApplicationId?:number;
    secondaryApplicationsIds:number[];
    startTime?:string;
    endTime?:string;
}