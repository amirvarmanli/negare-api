export interface EmailPort {
  send(to: string, subject: string, html: string): Promise<void>;
}
