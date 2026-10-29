/**
 * Three illustrative change reports. The wording is invented for the UI.
 * Every row is stored with isSample: true and must not be read as a real policy update.
 */

export const SAMPLE_CHANGES = [
  {
    slug: 'whatsapp',
    previousHash: 'sample-whatsapp-previous',
    currentHash: 'sample-whatsapp-current',
    detectedDaysAgo: 1,
    importance: 'critical' as const,
    tags: ['ai-training', 'data-sharing'] as const,
    changedSections: ['Messages', 'AI and product features'],
    summary:
      'A later version says private messages may be used to train AI models and shared with other companies in the same group.',
    whatItMeansForYou:
      'Chats that stayed on your device could also be used to improve models and to personalize ads on related products.',
    previousText: [
      'WhatsApp privacy policy.',
      'We collect your phone number and profile name to create an account.',
      'Private messages stay on your device, and we do not use message content to train artificial intelligence models.',
      'We do not share your message content with other companies for advertising.',
      'You can delete your account in settings. Undelivered messages are then removed from our servers.',
    ].join('\n\n'),
    currentText: [
      'WhatsApp privacy policy.',
      'We collect your phone number and profile name to create an account.',
      'Private messages, including photos and voice notes, may be used to train and improve our artificial intelligence models.',
      'We may share message content and usage information with other companies in our group so they can personalize ads and product suggestions.',
      'You can delete your account in settings. Undelivered messages are then removed from our servers.',
    ].join('\n\n'),
  },
  {
    slug: 'instagram',
    previousHash: 'sample-instagram-previous',
    currentHash: 'sample-instagram-current',
    detectedDaysAgo: 3,
    importance: 'high' as const,
    tags: ['data-selling', 'data-sharing'] as const,
    changedSections: ['Advertising', 'Sale of information'],
    summary:
      'A later version allows personal information to be sold to advertising partners.',
    whatItMeansForYou:
      'Advertisers could receive your phone number, contacts, or activity, not only see ads inside the app.',
    previousText: [
      'Instagram privacy policy.',
      'We use posts, follows, and device information to operate the service and show ads.',
      'We do not sell your personal information to advertising partners.',
      'You can download a copy of your information and delete your account from settings.',
    ].join('\n\n'),
    currentText: [
      'Instagram privacy policy.',
      'We use posts, follows, and device information to operate the service and show ads.',
      'We may sell your personal information, including your phone number, contact list, and usage data, to advertising partners.',
      'You can download a copy of your information and delete your account from settings.',
    ].join('\n\n'),
  },
  {
    slug: 'spotify',
    previousHash: 'sample-spotify-previous',
    currentHash: 'sample-spotify-current',
    detectedDaysAgo: 6,
    importance: 'medium' as const,
    tags: ['retention', 'deletion'] as const,
    changedSections: ['Account deletion', 'How long we keep data'],
    summary:
      'A later version keeps listening history for 24 months after the account is deleted.',
    whatItMeansForYou:
      'Closing the account does not immediately erase what you played. The history could remain for measurement and recommendations.',
    previousText: [
      'Spotify privacy policy.',
      'We store the songs and podcasts you play so we can recommend what to listen to next.',
      'When you delete your account, we delete your listening history.',
      'Payment details are kept only as long as needed for billing and refunds.',
    ].join('\n\n'),
    currentText: [
      'Spotify privacy policy.',
      'We store the songs and podcasts you play so we can recommend what to listen to next.',
      'When you delete your account, we keep your listening history for 24 months to measure advertising and improve recommendations.',
      'Payment details are kept only as long as needed for billing and refunds.',
    ].join('\n\n'),
  },
];
