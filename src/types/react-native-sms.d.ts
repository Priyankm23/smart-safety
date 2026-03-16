declare module 'react-native-sms' {
  type SmsOptions = {
    body?: string
    recipients?: string[]
    successTypes?: Array<'sent' | 'queued'>
    allowAndroidSendWithoutReadPermission?: boolean
    allowAndroidSendWithoutPrompt?: boolean
  }

  type SmsCallback = (completed: boolean, cancelled: boolean, error: boolean) => void

  const SendSMS: {
    send(options: SmsOptions, callback: SmsCallback): void
  }

  export default SendSMS
}
