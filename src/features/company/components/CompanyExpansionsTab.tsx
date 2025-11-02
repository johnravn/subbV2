// src/features/company/components/CompanyExpansionsTab.tsx
import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Select,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { ArrowDown, Trash } from 'iconoir-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { companyExpansionQuery, updateCompanyExpansion } from '../api/queries'

type AccountingSoftware = 'none' | 'conta'

type ExpansionConfig = {
  accounting_software?: AccountingSoftware
  accounting_api_key?: string | null
}

export default function CompanyExpansionsTab() {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

  // Load expansion config from database
  const { data: expansionData, isLoading: configLoading } = useQuery({
    ...(companyId
      ? companyExpansionQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'expansion'] as const,
          queryFn: () => Promise.resolve(null),
        }),
    enabled: !!companyId,
  })

  const [form, setForm] = React.useState<ExpansionConfig>({
    accounting_software: 'none',
    accounting_api_key: null,
  })

  const [isExpanded, setIsExpanded] = React.useState(true)

  // Hydrate form from query data
  // Note: We don't decrypt the API key for display (for security)
  // User will need to re-enter it to update
  React.useEffect(() => {
    if (expansionData) {
      setForm({
        accounting_software:
          expansionData.accounting_software === 'conta' ? 'conta' : 'none',
        accounting_api_key: null, // Don't display existing keys for security
      })
    } else {
      // No expansion record exists yet
      setForm({
        accounting_software: 'none',
        accounting_api_key: null,
      })
    }
  }, [expansionData])

  const saveMutation = useMutation({
    mutationFn: async (config: ExpansionConfig) => {
      if (!companyId) throw new Error('No company selected')
      return updateCompanyExpansion({
        companyId,
        accountingSoftware: config.accounting_software ?? 'none',
        apiKey: config.accounting_api_key || null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', companyId, 'expansion'] })
      success('Saved', 'Expansion settings have been updated.')
      // Clear the API key field after saving (for security)
      setForm((s) => ({ ...s, accounting_api_key: null }))
    },
    onError: (e: any) => {
      toastError('Save failed', e?.message ?? 'Please try again.')
    },
  })

  const setFormValue = <TKey extends keyof ExpansionConfig>(
    key: TKey,
    value: ExpansionConfig[TKey],
  ) => setForm((s) => ({ ...s, [key]: value }))

  const removeApiKeyMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return updateCompanyExpansion({
        companyId,
        accountingSoftware: expansionData?.accounting_software ?? 'none',
        apiKey: null, // Remove the API key
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', companyId, 'expansion'] })
      success('Removed', 'API key has been removed.')
    },
    onError: (e: any) => {
      toastError('Failed to remove API key', e?.message ?? 'Please try again.')
    },
  })

  if (configLoading) {
    return (
      <Box p="4">
        <Text>Loading…</Text>
      </Box>
    )
  }

  return (
    <Card
      size="4"
      style={{ minHeight: 0, overflow: 'auto' }}
    >
      <Box p="4">
        <Heading size="4" mb="4">
          Expansions
        </Heading>
        <Text as="div" size="2" color="gray" mb="4">
          Configure integrations and external services for your company.
        </Text>

        <Separator size="4" mb="4" />

        {/* Accounting Software Section */}
        <Box mb="6">
          <Flex align="center" gap="3" mb="3">
            <Button
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                padding: 0,
                cursor: 'pointer',
                background: 'transparent',
              }}
            >
              <Flex align="center" gap="2">
                <ArrowDown
                  width={16}
                  height={16}
                  style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}
                />
                <Heading size="3">Accounting Software</Heading>
              </Flex>
            </Button>
            {expansionData?.accounting_software &&
              expansionData.accounting_software !== 'none' &&
              expansionData.accounting_api_key_encrypted && (
                <Badge color="green" variant="soft">
                  API Key Configured
                </Badge>
              )}
          </Flex>
          <Text as="div" size="2" color="gray" mb="4">
            Connect your accounting software to sync data automatically.
          </Text>

          {isExpanded && (
            <Flex direction="column" gap="4" style={{ maxWidth: 520 }}>
              <Field label="Accounting software">
                <Select.Root
                  value={form.accounting_software ?? 'none'}
                  onValueChange={(value) =>
                    setFormValue(
                      'accounting_software',
                      value as AccountingSoftware,
                    )
                  }
                >
                  <Select.Trigger placeholder="Select accounting software" />
                  <Select.Content>
                    <Select.Item value="none">None</Select.Item>
                    <Select.Item value="conta">Conta</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Field>

              {form.accounting_software &&
                form.accounting_software !== 'none' && (
                  <Field
                    label={
                      <Flex align="center" gap="2">
                        <Text as="span">API Key</Text>
                        {expansionData?.accounting_api_key_encrypted && (
                          <Badge color="green" variant="soft" size="1">
                            ✓ Configured
                          </Badge>
                        )}
                      </Flex>
                    }
                  >
                    <Text as="div" size="1" color="gray" mb="2">
                      Enter your API key for{' '}
                      {formatSoftwareName(form.accounting_software)}
                    </Text>
                    <TextField.Root
                      type="password"
                      value={form.accounting_api_key ?? ''}
                      onChange={(e) =>
                        setFormValue(
                          'accounting_api_key',
                          e.target.value || null,
                        )
                      }
                      placeholder="Enter API key..."
                    />
                  </Field>
                )}

              {form.accounting_software &&
                form.accounting_software !== 'none' && (
                  <Box
                    style={{
                      padding: 12,
                      background: 'var(--gray-a2)',
                      borderRadius: 6,
                    }}
                  >
                    <Text as="div" size="1" color="gray">
                      <strong>Note:</strong> API keys are stored securely and
                      encrypted. Make sure you have the correct permissions to
                      generate API keys from your accounting software.
                    </Text>
                    {expansionData?.accounting_api_key_encrypted && (
                      <Text
                        as="div"
                        size="1"
                        color="gray"
                        mt="2"
                        style={{ fontStyle: 'italic' }}
                      >
                        An API key is already configured. Enter a new key to
                        update it.
                      </Text>
                    )}
                  </Box>
                )}

              {expansionData?.accounting_api_key_encrypted && (
                <Flex justify="end">
                  <Button
                    size="2"
                    variant="soft"
                    color="red"
                    onClick={() => removeApiKeyMutation.mutate()}
                    disabled={removeApiKeyMutation.isPending}
                  >
                    <Trash width={14} height={14} />
                    Remove API Key
                  </Button>
                </Flex>
              )}
            </Flex>
          )}
        </Box>

        {/* Footer actions */}
        <Separator size="4" mb="4" />
        <Flex justify="end" gap="3">
          <Button
            size="2"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </Flex>
      </Box>
    </Card>
  )
}

function Field({
  label,
  children,
}: {
  label: string | React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Box>
      {typeof label === 'string' ? (
        <Text as="div" size="2" color="gray" mb="1">
          {label}
        </Text>
      ) : (
        <Box mb="1">{label}</Box>
      )}
      <Box style={{ width: '100%' }}>{children}</Box>
    </Box>
  )
}

function formatSoftwareName(software: AccountingSoftware): string {
  const names: Record<AccountingSoftware, string> = {
    none: 'None',
    conta: 'Conta',
  }
  return names[software] || 'Unknown'
}
