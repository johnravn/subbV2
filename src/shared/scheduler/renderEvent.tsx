import { Badge, Flex, Text } from '@radix-ui/themes'
import { User } from 'iconoir-react'
import type { EventContentArg } from '@fullcalendar/core'

export function renderEvent(arg: EventContentArg) {
  const { timeText, event } = arg
  const kind = event.extendedProps['kind'] as
    | 'job'
    | 'meeting'
    | 'travel'
    | undefined

  return (
    <Flex align="center" gap="2">
      <Text size="1" weight="bold">
        {timeText}
      </Text>
      <Text size="1" truncate>
        {event.title}
      </Text>
      {kind && (
        <Badge
          size="1"
          color={
            kind === 'job' ? 'indigo' : kind === 'meeting' ? 'cyan' : 'orange'
          }
          variant="soft"
        >
          {kind}
        </Badge>
      )}
      {event.extendedProps['owner'] && <User width={12} height={12} />}
    </Flex>
  )
}
