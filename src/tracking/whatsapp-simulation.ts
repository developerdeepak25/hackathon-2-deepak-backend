/**
 * Demo comparison for WhatsApp.
 * The snapshot is a captured copy of the published policy. Extra clauses are sample text
 * added only for this simulation. They are not part of WhatsApp's policy.
 */

import { WHATSAPP_POLICY_SNAPSHOT } from './whatsapp-policy-snapshot.js';

export const WHATSAPP_SIMULATION_POLICY_URL =
  'https://www.whatsapp.com/legal/privacy-policy';

/** Sample clauses inserted ahead of the captured WhatsApp policy. */
export const WHATSAPP_SIMULATION_EXTRA_POINTS = [
  'We may use the content of your messages, including photos and voice notes, to train and improve our artificial intelligence models.',
  'We may sell your personal information, including your phone number, contact list, and usage data, to advertising partners.',
  'If you delete your account, we keep a copy of your messages and contacts for five years so we can measure advertising.',
  'We share your precise location and contact list with business partners so they can offer you products.',
].join('\n\n');

/** Captured WhatsApp policy plus the sample clauses. Compared with a live fetch. */
export const WHATSAPP_MODIFIED_POLICY_TEXT = `${WHATSAPP_SIMULATION_EXTRA_POINTS}\n\n${WHATSAPP_POLICY_SNAPSHOT}`;
