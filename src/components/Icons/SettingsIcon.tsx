import * as React from 'react'
import { Settings } from 'lucide-react-native'

type Props = {
    color?: string
    size?: number
    filled?: boolean
}

export default function SettingsIcon({ color = '#000', size = 24 }: Props) {
    return <Settings color={color} size={size} strokeWidth={1.5} />
}
