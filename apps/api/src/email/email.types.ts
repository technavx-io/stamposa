export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

/**
 * Contract for outbound transactional email. Add a gateway by implementing
 * this and registering it in EmailModule — nothing else in the codebase
 * changes. The console provider just logs, so the flow works in staging
 * without a real mailbox.
 */
export interface EmailProvider {
  sendEmail(params: { to: string; subject: string; text: string; html?: string }): Promise<void>;
}
