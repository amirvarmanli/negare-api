export interface SmsPort {
  send(
    to: string,
    template: string,
    params: Record<string, string>,
  ): Promise<void>;
}
