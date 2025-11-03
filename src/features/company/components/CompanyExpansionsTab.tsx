// src/features/company/components/CompanyExpansionsTab.tsx
import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  IconButton,
  Select,
  Separator,
  Switch,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { InfoCircle, Trash } from 'iconoir-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { getAvailableOrganizations } from '@features/home/api/queries'
import { companyExpansionQuery, updateCompanyExpansion } from '../api/queries'

type AccountingSoftware = 'none' | 'conta'

type ExpansionConfig = {
  accounting_software?: AccountingSoftware
  accounting_api_key?: string | null
  accounting_organization_id?: string | null
  accounting_api_read_only?: boolean
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

  // Track if user has clicked "Configure" to show the configuration UI
  const [isConfiguring, setIsConfiguring] = React.useState(false)
  // Track if user is in edit mode (when fully configured, they need to click Edit)
  const [isEditing, setIsEditing] = React.useState(false)

  // Local form state for API key input (always start fresh for security)
  const [apiKeyInput, setApiKeyInput] = React.useState<string>('')

  const [form, setForm] = React.useState<ExpansionConfig>({
    accounting_software: 'none',
    accounting_api_key: null,
    accounting_organization_id: null,
    accounting_api_read_only: true,
  })

  // Track if permissions toggle has been changed (to show save button)
  const [permissionsChanged, setPermissionsChanged] = React.useState(false)

  // Determine configuration state
  const hasApiKeyConfigured = !!expansionData?.accounting_api_key_encrypted
  const hasOrganizationConfigured = !!expansionData?.accounting_organization_id
  const isContaSelected =
    form.accounting_software === 'conta' ||
    expansionData?.accounting_software === 'conta'

  // Calculate completion status
  const step1Completed =
    isContaSelected && expansionData?.accounting_software === 'conta'
  const step2Completed = hasApiKeyConfigured
  const step3Completed = hasOrganizationConfigured
  const completedSteps = [
    step1Completed,
    step2Completed,
    step3Completed,
  ].filter(Boolean).length
  const isFullyConfigured = step1Completed && step2Completed && step3Completed

  // Auto-show configuration UI only if not fully configured (allow user to configure)
  // If fully configured, require Edit button click
  React.useEffect(() => {
    if (isContaSelected && !isFullyConfigured) {
      setIsConfiguring(true)
    } else if (isFullyConfigured) {
      setIsConfiguring(false)
      setIsEditing(false)
    }
  }, [isContaSelected, isFullyConfigured])

  // Fetch available organizations when Conta is selected and API key is configured
  const {
    data: availableOrganizations,
    isLoading: orgsLoading,
    error: orgsError,
    refetch: refetchOrganizations,
  } = useQuery({
    queryKey: ['conta', 'organizations', companyId],
    queryFn: getAvailableOrganizations,
    enabled: isContaSelected && hasApiKeyConfigured,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })

  // Hydrate form from query data
  React.useEffect(() => {
    if (expansionData) {
      setForm({
        accounting_software:
          expansionData.accounting_software === 'conta' ? 'conta' : 'none',
        accounting_api_key: null, // Never display existing keys for security
        accounting_organization_id:
          expansionData.accounting_organization_id || null,
        accounting_api_read_only: expansionData.accounting_api_read_only,
      })
      setPermissionsChanged(false)
    } else {
      setForm({
        accounting_software: 'none',
        accounting_api_key: null,
        accounting_organization_id: null,
        accounting_api_read_only: true,
      })
      setPermissionsChanged(false)
    }
  }, [expansionData])

  // Mutation for saving API key
  const saveApiKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      if (!companyId) throw new Error('No company selected')
      if (!form.accounting_software || form.accounting_software === 'none') {
        throw new Error('Please select an accounting software first')
      }
      return updateCompanyExpansion({
        companyId,
        accountingSoftware: form.accounting_software,
        apiKey: apiKey,
        organizationId: form.accounting_organization_id || undefined,
        readOnly: form.accounting_api_read_only,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', companyId, 'expansion'] })
      qc.invalidateQueries({ queryKey: ['conta', 'organizations', companyId] })
      success('API Key Saved', 'API key has been securely saved and encrypted.')
      setApiKeyInput('') // Clear input after saving
      // Refetch organizations after API key is saved
      setTimeout(() => {
        refetchOrganizations()
      }, 500)
    },
    onError: (e: any) => {
      toastError(
        'Failed to save API key',
        e?.message ?? 'Please check your API key and try again.',
      )
    },
  })

  // Mutation for confirming organization
  const confirmOrganizationMutation = useMutation({
    mutationFn: async (organizationId: string | null) => {
      if (!companyId) throw new Error('No company selected')
      if (!isContaSelected) {
        throw new Error('Please select Conta as your accounting software')
      }
      if (!hasApiKeyConfigured) {
        throw new Error('Please configure your API key first')
      }
      return updateCompanyExpansion({
        companyId,
        accountingSoftware: undefined, // Preserve existing
        apiKey: undefined, // Preserve existing
        organizationId: organizationId || null,
        readOnly: undefined, // Preserve existing
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', companyId, 'expansion'] })
      // Invalidate all income/expenses queries for this company to clear old data
      // This ensures the dashboard shows data for the new organization
      qc.invalidateQueries({
        queryKey: ['conta', 'income-expenses', companyId],
        exact: false,
      })
      success(
        'Organization Confirmed',
        'Your organization has been set up successfully. Dashboard data will update shortly.',
      )
    },
    onError: (e: any) => {
      toastError(
        'Failed to confirm organization',
        e?.message ?? 'Please try again.',
      )
    },
  })

  // Mutation for removing API key
  const removeApiKeyMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return updateCompanyExpansion({
        companyId,
        accountingSoftware: undefined, // Preserve existing
        apiKey: null, // Remove the API key
        organizationId: null, // Also remove organization when API key is removed
        readOnly: undefined, // Preserve existing
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', companyId, 'expansion'] })
      qc.invalidateQueries({ queryKey: ['conta', 'organizations', companyId] })
      // Invalidate all income/expenses queries to clear old data
      qc.invalidateQueries({
        queryKey: ['conta', 'income-expenses', companyId],
        exact: false,
      })
      success(
        'API Key Removed',
        'API key has been securely removed from the database.',
      )
      setApiKeyInput('')
      setForm((s) => ({ ...s, accounting_organization_id: null }))
    },
    onError: (e: any) => {
      toastError('Failed to remove API key', e?.message ?? 'Please try again.')
    },
  })

  // Mutation for deleting entire accounting software configuration
  const deleteConfigurationMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected')
      return updateCompanyExpansion({
        companyId,
        accountingSoftware: 'none',
        apiKey: null, // Remove the API key
        organizationId: null, // Remove organization
        readOnly: true, // Reset to default
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', companyId, 'expansion'] })
      qc.invalidateQueries({ queryKey: ['conta', 'organizations', companyId] })
      // Invalidate all income/expenses queries to clear old data
      qc.invalidateQueries({
        queryKey: ['conta', 'income-expenses', companyId],
        exact: false,
      })
      success(
        'Configuration Deleted',
        'Accounting software configuration has been completely removed.',
      )
      setApiKeyInput('')
      setIsEditing(false)
      setIsConfiguring(false)
    },
    onError: (e: any) => {
      toastError(
        'Failed to delete configuration',
        e?.message ?? 'Please try again.',
      )
    },
  })

  // Mutation for saving permissions change
  const savePermissionsMutation = useMutation({
    mutationFn: async (readOnly: boolean) => {
      if (!companyId) throw new Error('No company selected')
      return updateCompanyExpansion({
        companyId,
        accountingSoftware: undefined, // Preserve existing
        apiKey: undefined, // Preserve existing
        organizationId: undefined, // Preserve existing
        readOnly,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', companyId, 'expansion'] })
      success('Permissions Updated', 'API permissions have been updated.')
      setPermissionsChanged(false)
    },
    onError: (e: any) => {
      toastError(
        'Failed to update permissions',
        e?.message ?? 'Please try again.',
      )
    },
  })

  // Update accounting software selection
  const handleSoftwareChange = (value: AccountingSoftware) => {
    if (value === 'none') {
      setForm((s) => ({ ...s, accounting_software: 'none' }))
      setIsConfiguring(false)
      // Save 'none' selection
      updateCompanyExpansion({
        companyId: companyId!,
        accountingSoftware: 'none',
        apiKey: undefined, // Preserve existing if any
        organizationId: undefined, // Preserve existing if any
        readOnly: undefined, // Preserve existing if any
      })
        .then(() => {
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'expansion'],
          })
          success(
            'Software Selection Updated',
            'Accounting software has been set to None.',
          )
        })
        .catch((e) => {
          toastError(
            'Failed to save selection',
            e?.message ?? 'Please try again.',
          )
        })
    } else {
      setForm((s) => ({ ...s, accounting_software: value }))
      setIsConfiguring(true)
      // Save software selection immediately (preserve API key if exists)
      updateCompanyExpansion({
        companyId: companyId!,
        accountingSoftware: value,
        apiKey: undefined, // Preserve existing if any
        organizationId: undefined, // Preserve existing if any
        readOnly: undefined, // Preserve existing if any
      })
        .then(() => {
          qc.invalidateQueries({
            queryKey: ['company', companyId, 'expansion'],
          })
          success('Software Selected', 'Accounting software has been selected.')
        })
        .catch((e) => {
          toastError(
            'Failed to save selection',
            e?.message ?? 'Please try again.',
          )
        })
    }
  }

  if (configLoading) {
    return (
      <Box p="4">
        <Text>Loading…</Text>
      </Box>
    )
  }

  // Get badge for header
  const getStatusBadge = () => {
    if (isFullyConfigured) {
      return (
        <Badge color="green" variant="soft">
          Configured
        </Badge>
      )
    } else if (isConfiguring || isContaSelected) {
      return (
        <Badge color="amber" variant="soft">
          {completedSteps}/3 Steps
        </Badge>
      )
    } else {
      return (
        <Badge color="red" variant="soft">
          Not Configured
        </Badge>
      )
    }
  }

  return (
    <Card
      size="4"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        p="4"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box mb="4" style={{ flexShrink: 0 }}>
          <Heading size="4" mb="4">
            Expansions
          </Heading>
          <Text as="div" size="2" color="gray" mb="4">
            Configure integrations and external services for your company.
          </Text>
          <Separator size="4" mb="4" />
        </Box>

        {/* Scrollable content area */}
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {/* Accounting Software Section */}
          <Box mb="6">
            <Flex align="center" gap="3" mb="3">
              <Heading size="3">Accounting Software</Heading>
              {getStatusBadge()}
            </Flex>
            <Text as="div" size="2" color="gray" mb="4">
              Connect your accounting software to sync data automatically.
            </Text>

            {/* Initial state: Not configured */}
            {!isConfiguring && !isContaSelected && !isEditing && (
              <Flex direction="column" gap="4" style={{ maxWidth: 520 }}>
                <Box
                  style={{
                    padding: 16,
                    background: 'var(--gray-a2)',
                    borderRadius: 6,
                    border: '1px solid var(--gray-a6)',
                  }}
                >
                  <Text as="div" size="2" color="gray" mb="3">
                    No accounting software is configured for this company.
                  </Text>
                  <Button onClick={() => setIsConfiguring(true)} size="2">
                    Configure
                  </Button>
                </Box>
              </Flex>
            )}

            {/* Summary view when fully configured (not editing) */}
            {isFullyConfigured && !isEditing && !isConfiguring && (
              <Flex direction="column" gap="4" style={{ maxWidth: 520 }}>
                <Box
                  style={{
                    padding: 16,
                    background: 'var(--gray-a2)',
                    borderRadius: 6,
                    border: '1px solid var(--gray-a6)',
                  }}
                >
                  <Flex direction="column" gap="3">
                    <Text as="div" size="2" weight="medium">
                      Accounting software:{' '}
                      {formatSoftwareName(
                        expansionData.accounting_software as AccountingSoftware,
                      )}
                    </Text>
                    <Text as="div" size="2" color="gray">
                      API key: •••••••••••••••• (configured)
                    </Text>
                    {expansionData.accounting_organization_id && (
                      <Text as="div" size="2" color="gray">
                        Organization:{' '}
                        {availableOrganizations?.find(
                          (org) =>
                            org.id === expansionData.accounting_organization_id,
                        )?.name || expansionData.accounting_organization_id}
                      </Text>
                    )}
                    <Text as="div" size="2" color="gray">
                      Permissions:{' '}
                      {expansionData.accounting_api_read_only
                        ? 'Read-only'
                        : 'Full access'}
                    </Text>
                    <Flex gap="2" mt="2">
                      <Button onClick={() => setIsEditing(true)} size="2">
                        Edit
                      </Button>
                      <Button
                        variant="soft"
                        color="red"
                        onClick={() => {
                          if (
                            confirm(
                              'Are you sure you want to delete the entire accounting software configuration? This will remove the API key and organization selection.',
                            )
                          ) {
                            deleteConfigurationMutation.mutate()
                          }
                        }}
                        disabled={deleteConfigurationMutation.isPending}
                        size="2"
                      >
                        {deleteConfigurationMutation.isPending
                          ? 'Deleting...'
                          : 'Delete Configuration'}
                      </Button>
                    </Flex>
                  </Flex>
                </Box>
              </Flex>
            )}

            {/* Configuration UI - Show when configuring OR when editing */}
            {(isConfiguring || isEditing) && (
              <Flex direction="column" gap="6">
                {/* Select Accounting Software */}
                <Field label="Accounting Software">
                  <Select.Root
                    value={form.accounting_software ?? 'none'}
                    onValueChange={(value) =>
                      handleSoftwareChange(value as AccountingSoftware)
                    }
                  >
                    <Select.Trigger placeholder="Select accounting software" />
                    <Select.Content>
                      <Select.Item value="none">None</Select.Item>
                      <Select.Item value="conta">Conta</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Field>

                {/* Three-column layout for API Key, Organization, and Permissions */}
                {form.accounting_software &&
                  form.accounting_software !== 'none' && (
                    <Box
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 24,
                      }}
                    >
                      {/* API Key Column */}
                      <Field label="API Key">
                        <Flex direction="column" gap="2">
                          <TextField.Root
                            type="password"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder={
                              step2Completed
                                ? 'Enter new API key to update...'
                                : 'Enter API key...'
                            }
                            disabled={saveApiKeyMutation.isPending}
                          >
                            <TextField.Slot side="right">
                              <Tooltip
                                content={`Enter your API key for ${formatSoftwareName(form.accounting_software)}`}
                                delayDuration={300}
                              >
                                <IconButton
                                  size="1"
                                  variant="ghost"
                                  color="gray"
                                  style={{ cursor: 'help' }}
                                >
                                  <InfoCircle width={14} height={14} />
                                </IconButton>
                              </Tooltip>
                            </TextField.Slot>
                          </TextField.Root>
                          <Flex align="center" gap="2" mt="1" wrap="wrap">
                            {step2Completed && (
                              <>
                                <Badge color="green" variant="soft" size="1">
                                  Configured
                                </Badge>
                                <Button
                                  size="1"
                                  variant="soft"
                                  color="red"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        'Are you sure you want to remove the API key? This will also remove the organization selection.',
                                      )
                                    ) {
                                      removeApiKeyMutation.mutate()
                                    }
                                  }}
                                  disabled={removeApiKeyMutation.isPending}
                                >
                                  <Trash width={12} height={12} />
                                  Remove
                                </Button>
                              </>
                            )}
                            {apiKeyInput.trim() && (
                              <Button
                                size="2"
                                onClick={() => {
                                  if (apiKeyInput.trim()) {
                                    saveApiKeyMutation.mutate(
                                      apiKeyInput.trim(),
                                    )
                                  }
                                }}
                                disabled={saveApiKeyMutation.isPending}
                              >
                                {saveApiKeyMutation.isPending
                                  ? 'Saving...'
                                  : step2Completed
                                    ? 'Update API Key'
                                    : 'Save API Key'}
                              </Button>
                            )}
                          </Flex>
                        </Flex>
                      </Field>

                      {/* Organization Column */}
                      <Field label="Organization">
                        {!step2Completed ? (
                          <Box
                            style={{
                              padding: 12,
                              background: 'var(--gray-a2)',
                              borderRadius: 6,
                            }}
                          >
                            <Text size="1" color="gray">
                              Configure your API key first to select an
                              organization.
                            </Text>
                          </Box>
                        ) : orgsLoading ? (
                          <Text size="2" color="gray">
                            Loading organizations...
                          </Text>
                        ) : orgsError ? (
                          <Box
                            style={{
                              padding: 12,
                              background: 'var(--red-2)',
                              borderRadius: 6,
                            }}
                          >
                            <Text size="2" color="red" weight="medium" mb="1">
                              Error loading organizations
                            </Text>
                            <Text size="1" color="red">
                              {orgsError instanceof Error
                                ? orgsError.message
                                : 'Failed to fetch organizations from API'}
                            </Text>
                          </Box>
                        ) : availableOrganizations &&
                          availableOrganizations.length > 0 ? (
                          <Flex direction="column" gap="2">
                            <Select.Root
                              value={form.accounting_organization_id ?? ''}
                              onValueChange={(value) =>
                                setForm((s) => ({
                                  ...s,
                                  accounting_organization_id: value || null,
                                }))
                              }
                            >
                              <Select.Trigger placeholder="Select organization" />
                              <Select.Content>
                                {availableOrganizations.map((org) => (
                                  <Select.Item key={org.id} value={org.id}>
                                    {org.name || org.id}
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select.Root>
                            {form.accounting_organization_id &&
                              (form.accounting_organization_id !==
                                expansionData.accounting_organization_id ||
                                !step3Completed) && (
                                <Button
                                  size="2"
                                  onClick={() => {
                                    confirmOrganizationMutation.mutate(
                                      form.accounting_organization_id || null,
                                    )
                                  }}
                                  disabled={
                                    confirmOrganizationMutation.isPending ||
                                    !form.accounting_organization_id
                                  }
                                >
                                  {confirmOrganizationMutation.isPending
                                    ? 'Saving...'
                                    : step3Completed
                                      ? 'Update Organization'
                                      : 'Confirm Organization'}
                                </Button>
                              )}
                          </Flex>
                        ) : (
                          <Box
                            style={{
                              padding: 12,
                              background: 'var(--orange-2)',
                              borderRadius: 6,
                            }}
                          >
                            <Text
                              size="2"
                              color="orange"
                              weight="medium"
                              mb="1"
                            >
                              No organizations found
                            </Text>
                            <Text size="1" color="orange">
                              Could not fetch organizations from API. Please
                              check your API key.
                            </Text>
                          </Box>
                        )}
                      </Field>
                      {/* API Permissions Column */}
                      <Field label="API Permissions">
                        <Flex direction="column" gap="3">
                          <Flex align="center" justify="between" gap="4">
                            <Flex
                              direction="column"
                              gap="1"
                              style={{ flex: 1 }}
                            >
                              <Text size="2" weight="medium">
                                Read-Only Mode
                              </Text>
                              <Text size="1" color="gray">
                                {form.accounting_api_read_only
                                  ? 'Only read operations (GET) are allowed'
                                  : 'All operations (GET, POST, PUT, DELETE) are allowed'}
                              </Text>
                            </Flex>
                            <Switch
                              checked={form.accounting_api_read_only ?? true}
                              onCheckedChange={(checked) => {
                                setForm((s) => ({
                                  ...s,
                                  accounting_api_read_only: checked,
                                }))
                                setPermissionsChanged(true)
                              }}
                              disabled={savePermissionsMutation.isPending}
                            />
                          </Flex>
                          {permissionsChanged && (
                            <Button
                              size="2"
                              onClick={() => {
                                savePermissionsMutation.mutate(
                                  form.accounting_api_read_only ?? true,
                                )
                              }}
                              disabled={savePermissionsMutation.isPending}
                              style={{ alignSelf: 'flex-start' }}
                            >
                              {savePermissionsMutation.isPending
                                ? 'Saving...'
                                : 'Save Permissions'}
                            </Button>
                          )}
                        </Flex>
                      </Field>
                    </Box>
                  )}

                {/* Security Note */}
                <Box
                  style={{
                    padding: 12,
                    background: 'var(--blue-2)',
                    borderRadius: 6,
                    border: '1px solid var(--blue-6)',
                  }}
                >
                  <Text as="div" size="1" color="blue">
                    <strong>Security:</strong> API keys are stored securely and
                    encrypted. They are never displayed once saved. Make sure
                    you have the correct permissions to generate API keys from
                    your accounting software.
                  </Text>
                </Box>

                {/* Action Buttons - Show when editing */}
                {isEditing && (
                  <Flex
                    justify="end"
                    gap="3"
                    pt="4"
                    style={{ borderTop: '1px solid var(--gray-a6)' }}
                  >
                    <Button
                      variant="soft"
                      onClick={() => {
                        setIsEditing(false)
                        // Reset form to saved state
                        if (expansionData) {
                          setForm({
                            accounting_software:
                              expansionData.accounting_software === 'conta'
                                ? 'conta'
                                : 'none',
                            accounting_api_key: null,
                            accounting_organization_id:
                              expansionData.accounting_organization_id || null,
                            accounting_api_read_only:
                              expansionData.accounting_api_read_only,
                          })
                          setApiKeyInput('')
                          setPermissionsChanged(false)
                        }
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      onClick={async () => {
                        // Save all pending changes
                        try {
                          // Save API key if entered
                          if (apiKeyInput.trim()) {
                            await saveApiKeyMutation.mutateAsync(
                              apiKeyInput.trim(),
                            )
                          }

                          // Confirm organization if changed
                          if (
                            form.accounting_organization_id !== undefined &&
                            form.accounting_organization_id !==
                              expansionData?.accounting_organization_id
                          ) {
                            await confirmOrganizationMutation.mutateAsync(
                              form.accounting_organization_id || null,
                            )
                          }

                          // Save permissions if changed
                          if (permissionsChanged) {
                            await savePermissionsMutation.mutateAsync(
                              form.accounting_api_read_only ?? true,
                            )
                          }

                          setIsEditing(false)
                          setApiKeyInput('')
                          setPermissionsChanged(false)
                        } catch (error) {
                          // Errors are handled by individual mutations
                        }
                      }}
                      disabled={
                        saveApiKeyMutation.isPending ||
                        confirmOrganizationMutation.isPending ||
                        savePermissionsMutation.isPending ||
                        (!apiKeyInput.trim() &&
                          !permissionsChanged &&
                          form.accounting_organization_id ===
                            expansionData?.accounting_organization_id)
                      }
                    >
                      {saveApiKeyMutation.isPending ||
                      confirmOrganizationMutation.isPending ||
                      savePermissionsMutation.isPending
                        ? 'Saving...'
                        : 'Save Changes'}
                    </Button>
                  </Flex>
                )}
              </Flex>
            )}
          </Box>
        </Box>
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
