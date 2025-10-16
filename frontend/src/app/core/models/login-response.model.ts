export interface LoginResponse {
  token_valid: boolean;
  user_details: UserDetails;
}

interface UserDetails {
  email: string;
  name: string;
  user_token: string;
  isPresent: string;
}
