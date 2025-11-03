// src/features/jobs/components/tabs/MoneyTab.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Card, Flex, Heading, Text } from '@radix-ui/themes'
import { CheckCircle, XmarkCircle, InfoCircle } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useCompany } from '@shared/companies/CompanyProvider'
import {
  IncomeExpensesChart,
  ChartTypeSelector,
} from '@shared/ui/components/IncomeExpensesChart'
import type { JobOffer } from '../../types'

export default function MoneyTab({ jobId }: { jobId: string }) {
  const { companyId } = useCompany()
  const [chartType, setChartType] = React.useState<
    'bar' | 'line' | 'area' | 'composed'
  >('area')

  // Fetch accepted offers for this job
  const { data: acceptedOffers = [], isLoading } = useQuery({
    queryKey: ['jobs', jobId, 'money', 'accepted-offers'],
    queryFn: async (): Promise<Array<JobOffer>> => {
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'accepted')
        .order('accepted_at', { ascending: false })

      if (error) throw error
      return data as Array<JobOffer>
    },
  })

  // Get accounting organization ID from company_expansions
  const { data: accountingConfig } = useQuery({
    queryKey: ['company', companyId, 'accounting-config'],
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('company_expansions')
        .select('accounting_organization_id, accounting_software')
        .eq('company_id', companyId)
        .maybeSingle()

      if (error) throw error
      return data as {
        accounting_organization_id: string | null
        accounting_software: string | null
      } | null
    },
    enabled: !!companyId,
  })

  // Placeholder for expenses from accounting API
  // TODO: Implement actual expense fetching from accounting software
  const expenses = React.useMemo(() => {
    // For now, return empty array - expenses will be fetched from accounting API
    // when integration is complete
    return []
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // Calculate total income from accepted offers
  const totalIncome = acceptedOffers.reduce(
    (sum, offer) => sum + offer.total_with_vat,
    0,
  )

  // Calculate total expenses (placeholder - will come from accounting API)
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)

  // Calculate profit/loss
  const profitLoss = totalIncome - totalExpenses

  // Prepare chart data (monthly breakdown)
  const chartData = React.useMemo(() => {
    // For now, aggregate by month from accepted offers
    const monthlyData = new Map<string, { income: number; expenses: number }>()

    // Add income from accepted offers
    acceptedOffers.forEach((offer) => {
      if (offer.accepted_at) {
        const date = new Date(offer.accepted_at)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const monthName = date.toLocaleDateString('nb-NO', {
          month: 'long',
          year: 'numeric',
        })

        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, { income: 0, expenses: 0 })
        }
        const data = monthlyData.get(monthKey)!
        data.income += offer.total_with_vat
      }
    })

    // Add expenses (placeholder - will come from accounting API)
    expenses.forEach((exp) => {
      const date = new Date(exp.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { income: 0, expenses: 0 })
      }
      const data = monthlyData.get(monthKey)!
      data.expenses += exp.amount
    })

    // Convert to array and sort by month
    return Array.from(monthlyData.entries())
      .map(([key, data]) => {
        const [year, month] = key.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return {
          month: date.toLocaleDateString('nb-NO', {
            month: 'short',
            year: 'numeric',
          }),
          income: data.income,
          expenses: data.expenses,
        }
      })
      .sort((a, b) => {
        // Simple sort by month name (will work for recent months)
        return a.month.localeCompare(b.month)
      })
  }, [acceptedOffers, expenses])

  if (isLoading) {
    return (
      <Box>
        <Heading size="3" mb="3">
          Money
        </Heading>
        <Text>Loading financial data...</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="3">
        <Heading size="3">Money</Heading>
        {chartData.length > 0 && (
          <ChartTypeSelector
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
        )}
      </Flex>

      {/* Financial Summary Cards */}
      <Flex gap="3" mb="4" wrap="wrap">
        <Card style={{ flex: 1, minWidth: 200 }}>
          <Flex direction="column" gap="2">
            <Text size="2" color="gray">
              Total Income
            </Text>
            <Heading size="6" color="green">
              {formatCurrency(totalIncome)}
            </Heading>
            <Text size="1" color="gray">
              {acceptedOffers.length} accepted offer
              {acceptedOffers.length !== 1 ? 's' : ''}
            </Text>
          </Flex>
        </Card>

        <Card style={{ flex: 1, minWidth: 200 }}>
          <Flex direction="column" gap="2">
            <Text size="2" color="gray">
              Total Expenses
            </Text>
            <Heading size="6" color="red">
              {formatCurrency(totalExpenses)}
            </Heading>
            <Text size="1" color="gray">
              {accountingConfig?.accounting_organization_id
                ? 'From accounting software'
                : 'Not connected'}
            </Text>
          </Flex>
        </Card>

        <Card style={{ flex: 1, minWidth: 200 }}>
          <Flex direction="column" gap="2">
            <Text size="2" color="gray">
              Net Profit/Loss
            </Text>
            <Heading size="6" color={profitLoss >= 0 ? 'green' : 'red'}>
              {formatCurrency(profitLoss)}
            </Heading>
            <Flex align="center" gap="1">
              {profitLoss >= 0 ? (
                <CheckCircle width={14} height={14} color="var(--green-9)" />
              ) : (
                <XmarkCircle width={14} height={14} color="var(--red-9)" />
              )}
              <Text size="1" color={profitLoss >= 0 ? 'green' : 'red'}>
                {profitLoss >= 0 ? 'Profit' : 'Loss'}
              </Text>
            </Flex>
          </Flex>
        </Card>
      </Flex>

      {/* Accepted Offers Breakdown */}
      {acceptedOffers.length > 0 && (
        <Card mb="4">
          <Heading size="4" mb="3">
            Accepted Offers
          </Heading>
          <Flex direction="column" gap="2">
            {acceptedOffers.map((offer) => (
              <Flex
                key={offer.id}
                justify="between"
                align="center"
                p="2"
                style={{
                  background: 'var(--gray-a2)',
                  borderRadius: 6,
                }}
              >
                <Flex direction="column" gap="1">
                  <Text weight="medium">{offer.title}</Text>
                  <Text size="1" color="gray">
                    Accepted{' '}
                    {offer.accepted_at
                      ? new Date(offer.accepted_at).toLocaleDateString(
                          'nb-NO',
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          },
                        )
                      : '—'}
                  </Text>
                </Flex>
                <Text size="4" weight="medium" color="green">
                  {formatCurrency(offer.total_with_vat)}
                </Text>
              </Flex>
            ))}
          </Flex>
        </Card>
      )}

      {/* Chart */}
      {chartData.length > 0 ? (
        <Card mb="4">
          <Heading size="4" mb="3">
            Income vs Expenses
          </Heading>
          <Box style={{ height: 400, width: '100%' }}>
            <IncomeExpensesChart
              data={chartData}
              height={400}
              chartType={chartType}
              onChartTypeChange={setChartType}
            />
          </Box>
        </Card>
      ) : (
        <Card mb="4">
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            style={{ minHeight: 300, padding: '40px' }}
          >
            <Text size="3" color="gray" align="center">
              No financial data yet
            </Text>
            <Text size="2" color="gray" align="center">
              Once offers are accepted, they will appear here along with
              expenses from your accounting software.
            </Text>
          </Flex>
        </Card>
      )}

      {/* Accounting Software Integration Info */}
      {!accountingConfig?.accounting_organization_id && (
        <Card style={{ background: 'var(--blue-a2)' }}>
          <Flex gap="3" align="start">
            <Box style={{ paddingTop: '2px' }}>
              <InfoCircle width={20} height={20} color="var(--blue-9)" />
            </Box>
            <Box style={{ flex: 1 }}>
              <Heading size="3" mb="1">
                Connect Accounting Software
              </Heading>
              <Text size="2" color="gray" mb="2">
                Connect your accounting software in Company settings to
                automatically pull expenses and get a complete financial
                overview of your jobs.
              </Text>
              <Text size="1" color="gray">
                Once connected, expenses will be automatically synchronized and
                displayed in charts and summaries.
              </Text>
            </Box>
          </Flex>
        </Card>
      )}
    </Box>
  )
}
