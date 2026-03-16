import * as React from 'react'
import { Calendar } from 'lucide-react-native'

type Props = {
    color?: string
    size?: number
    filled?: boolean
}

export default function ItineraryIcon({ color = '#000', size = 24 }: Props) {
    return <Calendar color={color} size={size} strokeWidth={1.5} />
}
