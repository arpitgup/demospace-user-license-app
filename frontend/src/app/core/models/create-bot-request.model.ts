export interface CreateBotRequest {
  bots: BotDetails[];
}

export interface BotDetails {
  name: string;
  email: string;
  is_admin: boolean;
  application_ids: number[];
}
