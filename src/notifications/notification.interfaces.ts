export enum EmailProviders {
  SENDGRID = 'sendgrid',
  //   MAILGUN = 'mailgun',
  //   AWS_SES = 'aws-ses',
  //   RESEND = 'resend',
  //   SMTP = 'smtp',
  //   MOCK = 'mock',
}

export enum SmsProviders {
  TWILIO = 'twilio',
  //   AWS_SNS = 'aws-sns',
  //   NEXMO = 'nexmo',
  //   PLIVO = 'plivo',
  //   MOCK = 'mock',
  AFRICASTALK = 'africastalk',
}

export enum PushProviders {
  //   FCM = 'fcm',
  //   APNS = 'apns',
  EXPO = 'expo',
  //   MOCK = 'mock',
}

export type NotificationOptions = {
  emailProviders: EmailProviders[];
  smsProviders: SmsProviders[];
  pushProviders: PushProviders[];
};

export type NotificationModuleOptions = {
  global?: boolean;
  options: NotificationOptions;
};
