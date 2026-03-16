import * as React from 'react'
import { Home } from 'lucide-react-native'

type Props = {
  color?: string
  size?: number
  filled?: boolean
}

export default function DashboardLogo({ color = '#000', size = 24 }: Props) {
  return <Home color={color} size={size} strokeWidth={1.5} />
}
