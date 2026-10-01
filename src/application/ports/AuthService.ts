export type Credentials = { email: string; password: string };

export type Session = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
};

export interface AuthService {
  login(credentials: Credentials): Promise<Session>;
  refresh(refreshToken: string): Promise<Session>;
}
