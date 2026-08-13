import type { ReactNode } from 'react'
import { Root, Trigger, Portal, Content, Arrow } from '@radix-ui/react-tooltip'

interface TooltipProps {
  label: string
  children: ReactNode
}

function Tooltip({ label, children }: TooltipProps) {
  return (
    <Root>
      <Trigger asChild>{children}</Trigger>
      <Portal>
        <Content className="tooltip-content" sideOffset={6}>
          {label}
          <Arrow className="tooltip-arrow" />
        </Content>
      </Portal>
    </Root>
  )
}

export default Tooltip
