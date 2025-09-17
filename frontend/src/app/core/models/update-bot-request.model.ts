export interface UpdateBotRequest {
  bots: BotRequest[];
}

export interface BotRequest {
  id: number;
  is_admin:boolean
  application_ids: number[];
}
