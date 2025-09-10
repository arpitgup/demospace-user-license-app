export interface UpdateBotRequest {
  bots: BotRequest[];
}

export interface BotRequest {
  name: string;
  email: string;
  application_ids: number[];
}
