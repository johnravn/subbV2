// src/features/jobs/components/dialogs/AddCrewToRoleDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { Check } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import type { UUID } from '../../types'

export default function AddCrewToRoleDialog({
  open,
  onOpenChange,
  jobId,
  timePeriodId,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
  timePeriodId: UUID
  companyId: UUID
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [search, setSearch] = React.useState('')
  const [selectedIds, setSelectedIds] = React.useState<Set<UUID>>(new Set())

  // Get existing crew for this role to filter them out
  const { data: existingCrew = [] } = useQuery({
    queryKey: ['jobs.crew', jobId, 'role', timePeriodId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reserved_crew')
        .select('user_id')
        .eq('time_period_id', timePeriodId)
      if (error) throw error
      return (data || []) as Array<{ user_id: UUID }>
    },
  })


  // Search crew by name/email (filters out already assigned crew)
  const existingUserIds = React.useMemo(
    () => new Set(existingCrew.map((c) => c.user_id)),
    [existingCrew],
  )

  const { data: people = [], isFetching } = useQuery({
    queryKey: ['crew-picker', search, timePeriodId, existingUserIds.size],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .limit(50)

      if (search.trim()) {
        q = q.or(
          `display_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`,
        )
      }

      const { data, error } = await q
      if (error) throw error
      
      // Filter out crew already assigned to this role
      return (data || []).filter(
        (p) => !existingUserIds.has(p.user_id),
      ) as Array<{
        user_id: UUID
        display_name: string | null
        email: string
      }>
    },
  })

  const toggleSelection = (userId: UUID) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const save = useMutation({
    mutationFn: async () => {
      if (selectedIds.size === 0) {
        throw new Error('Please select at least one crew member')
      }

      const payload = Array.from(selectedIds).map((userId) => ({
        time_period_id: timePeriodId,
        user_id: userId,
        status: 'planned' as const,
        notes: null,
      }))

      const { error } = await supabase
        .from('reserved_crew')
        .insert(payload)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      success('Success', `Added ${selectedIds.size} crew member(s) to role`)
      setSelectedIds(new Set())
      onOpenChange(false)
    },
    onError: (e: any) => {
      toastError(
        'Failed to add crew',
        e?.hint || e?.message || 'Please try again.',
      )
    },
  })

  React.useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedIds(new Set())
    }
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 600 }}>
        <Dialog.Title>Add Crew to Role</Dialog.Title>
        <Dialog.Description>
          Select crew members to add to this role
        </Dialog.Description>

        <Box my="4">
          <TextField.Root
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Box>

        <Box
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            border: '1px solid var(--gray-a6)',
            borderRadius: 8,
            padding: 8,
          }}
        >
          {isFetching && (
            <Text size="2" color="gray">
              Searching…
            </Text>
          )}
          {!isFetching && people.length === 0 && (
            <Text size="2" color="gray">
              No crew members found
            </Text>
          )}
          {!isFetching &&
            people.map((p, idx) => {
              const isSelected = selectedIds.has(p.user_id)
              return (
                <React.Fragment key={p.user_id}>
                  <Box
                    p="2"
                    style={{
                      cursor: 'pointer',
                      borderRadius: 6,
                      background: isSelected
                        ? 'var(--blue-a3)'
                        : 'transparent',
                    }}
                    onClick={() => toggleSelection(p.user_id)}
                  >
                    <Flex align="center" justify="between">
                      <Flex align="center" gap="2">
                        {isSelected && (
                          <Check
                            width={18}
                            height={18}
                            style={{ color: 'var(--blue-11)' }}
                          />
                        )}
                        <div>
                          <Text weight="medium">
                            {p.display_name ?? p.email}
                          </Text>
                          {p.display_name && (
                            <Text size="1" color="gray" style={{ marginLeft: 6 }}>
                              {p.email}
                            </Text>
                          )}
                        </div>
                      </Flex>
                      {isSelected && (
                        <Text size="1" color="blue">
                          Selected
                        </Text>
                      )}
                    </Flex>
                  </Box>
                  {idx < people.length - 1 && <Separator my="2" />}
                </React.Fragment>
              )
            })}
        </Box>

        <Flex mt="4" gap="2" justify="end">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            onClick={() => save.mutate()}
            disabled={selectedIds.size === 0 || save.isPending}
          >
            {save.isPending
              ? 'Adding…'
              : `Add ${selectedIds.size} crew member${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

