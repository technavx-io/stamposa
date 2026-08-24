export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/**
 * Contract for outbound OTP delivery. Text gateways (console, Twilio) send
 * the ready-made message; DLT template gateways (MSG91) send the code as a
 * template variable. Add a gateway by implementing this and registering it
 * in SmsModule — nothing else in the codebase changes.
 */
export interface SmsProvider {
  sendOtp(phoneE164: string, code: string, message: string): Promise<void>;
}
