import * as React from 'react'
import { Text } from '@radix-ui/themes'
import TimePeriodPicker from '@features/calendar/components/reservations/TimePeriodPicker'

export default function TimelineTab({ jobId }: { jobId: string }) {
  const [timePeriodId, setTimePeriodId] = React.useState<string | null>(null)

  return (
    <>
      <TimePeriodPicker
        jobId={jobId}
        value={timePeriodId}
        onChange={setTimePeriodId}
      />
    </>
  )
}
