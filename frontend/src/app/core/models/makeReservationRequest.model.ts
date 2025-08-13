
export interface MakeReservationRequest{
    primaryApplicationId?:number;
    secondaryApplicationIds:number[];
    startTime?:string;
    endTime?:string;
}