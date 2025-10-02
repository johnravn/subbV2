import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { addFreelancerOrInvite } from '../../api/queries'

type AddInviteResult =
  | { type: 'added' }
  | { type: 'invited' }
  | { type: 'already_invited'; by: string }
  | {
      type: 'already_member'
      role: 'owner' | 'employee' | 'freelancer' | 'super_user'
    }

export default function AddFreelancerDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdded?: () => void
}) {
  const { companyId } = useCompany()
  const { info, error } = useToast()
  const [email, setEmail] = React.useState('')

  const normalized = email.trim().toLowerCase()
  const canSubmit =
    !!companyId && !!normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)

  const mut = useMutation<AddInviteResult, unknown, void>({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return await addFreelancerOrInvite({
        companyId,
        email: normalized,
      })
    },
    onSuccess: (res) => {
      if (res.type === 'added') {
        info(
          'Freelancer added',
          'They already had an account and were added to your company.',
        )
      } else if (res.type === 'invited') {
        info(
          'Invite created',
          'They will be added automatically when they sign up.',
        )
      } else if (res.type === 'already_invited') {
        info('Already invited', `An invite already exists by ${res.by}.`)
      } else {
        info('Already a member', `This user is already in your crew.`)
      }
      setEmail('')
      onOpenChange(false) // only close on success
      onAdded?.()
    },
    onError: (e: any) => {
      error('Failed', e?.message ?? 'Please try again.')
      console.log(e?.message)
    },
  })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || mut.isPending) return
    mut.mutate()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Add freelancer</Dialog.Title>
        <Dialog.Description size="2">
          Enter the person’s email. If they already have an account, they’ll be
          added immediately. Otherwise, they’ll appear as a pending invite
          (expires in 30 days).
        </Dialog.Description>

        <form onSubmit={onSubmit}>
          <Flex direction="column" gap="3" mt="3">
            <label>
              <Text size="2">Email</Text>
              <TextField.Root
                type="email"
                required
                placeholder="freelancer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </label>
          </Flex>

          <Flex gap="3" justify="end" mt="4">
            <Dialog.Close>
              <Button type="button" variant="soft" disabled={mut.isPending}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={!canSubmit || mut.isPending}>
              {mut.isPending ? 'Saving…' : 'Add'}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
