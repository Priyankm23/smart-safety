import * as SMS from 'expo-sms'
import { NativeModules, PermissionsAndroid, Platform } from 'react-native'

export type SmsPayload = {
  recipients: string[]
  message: string
}

type AndroidSmsPermissionStatus = 'granted' | 'denied' | 'never_ask_again'

async function requestAndroidSendPermission(): Promise<AndroidSmsPermissionStatus> {
  if (Platform.OS !== 'android') return 'granted'
  const permission = PermissionsAndroid.PERMISSIONS.SEND_SMS
  const hasPermission = await PermissionsAndroid.check(permission)
  if (hasPermission) return 'granted'

  const result = await PermissionsAndroid.request(permission)
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted'
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'never_ask_again'
  return 'denied'
}

type DirectSmsModuleType = {
  sendSms: (recipients: string[], message: string) => Promise<any>
}

async function openSmsComposerFallback(
  payload: SmsPayload,
  fallbackReason: string,
): Promise<{ ok: boolean; result?: any; reason?: string }> {
  try {
    const isAvailable = await SMS.isAvailableAsync()
    if (!isAvailable) {
      return { ok: false, reason: 'sms_unavailable' }
    }

    const res = await SMS.sendSMSAsync(payload.recipients, payload.message)
    const channelResult = {
      channel: 'android-composer-fallback',
      fallbackReason,
      ...res,
    }

    if (res?.result === 'cancelled') {
      return { ok: false, reason: 'composer_cancelled', result: channelResult }
    }
    return { ok: true, result: channelResult }
  } catch (e) {
    console.warn('[sms] openSmsComposerFallback failed', e)
    return { ok: false, reason: 'composer_fallback_failed' }
  }
}

// Attempt to send SMS. On Android, send directly without opening the SMS app.
// On other platforms, fall back to expo-sms which may open the composer.
export async function sendSMS(
  payload: SmsPayload,
): Promise<{ ok: boolean; result?: any; reason?: string }> {
  try {
    if (!Array.isArray(payload.recipients) || payload.recipients.length === 0) {
      return { ok: false, reason: 'no_recipients' }
    }

    if (Platform.OS === 'android') {
      const permissionStatus = await requestAndroidSendPermission()
      if (permissionStatus !== 'granted') {
        const reason =
          permissionStatus === 'never_ask_again'
            ? 'permission_never_ask_again'
            : 'permission_denied'
        console.warn('[sms] SEND_SMS not granted, opening composer fallback', { reason })
        return await openSmsComposerFallback(payload, reason)
      }

      const directSmsModule = NativeModules.DirectSmsModule as DirectSmsModuleType | undefined
      if (!directSmsModule?.sendSms) {
        console.warn('[sms] DirectSmsModule unavailable, opening composer fallback')
        return await openSmsComposerFallback(payload, 'direct_module_unavailable')
      }

      try {
        const result = await directSmsModule.sendSms(payload.recipients, payload.message)
        return { ok: true, result }
      } catch (err) {
        console.warn('[sms] Android native direct send failed', err)
        return await openSmsComposerFallback(payload, 'direct_send_failed')
      }
    }

    if (Platform.OS === 'web') {
      return { ok: false, reason: 'web_unsupported' }
    }
    const isAvailable = await SMS.isAvailableAsync()
    if (!isAvailable) {
      return { ok: false, reason: 'sms_unavailable' }
    }
    const res = await SMS.sendSMSAsync(payload.recipients, payload.message)
    return { ok: true, result: { channel: 'expo-fallback', ...res } }
  } catch (e) {
    console.warn('sendSMS failed', e)
    return { ok: false, reason: 'unexpected_error' }
  }
}

export default { sendSMS }
