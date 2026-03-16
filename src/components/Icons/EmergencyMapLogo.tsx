import * as React from 'react'
import { MapPin } from 'lucide-react-native'
import { View } from 'react-native'

type Props = {
  color?: string
  size?: number
  filled?: boolean
}

export default function EmergencyMapLogo({ color = '#000', size = 24 }: Props) {
  const s = size
  return (
    <View style={{ width: s, height: s }}>
      <MapPin size={s} color={color} strokeWidth={1.5} />
    </View>
  )
}
