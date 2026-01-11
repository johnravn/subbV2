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

  // Fetch company general rates
  const { data: companyRates } = useQuery({
    queryKey: ['company', companyId, 'general-rates'] as const,
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('companies')
        .select('employee_daily_rate, employee_hourly_rate, owner_daily_rate, owner_hourly_rate')
        .eq('id', companyId)
        .single()
      if (error) throw error
      return data
    },
  })

  // Fetch crew bookings with user info and rates
  const { data: crewBookings } = useQuery({
    queryKey: ['jobs', jobId, 'money', 'crew-expenses'],
    enabled: !!companyId,
    queryFn: async () => {
      // Get all crew time periods for this job
      const { data: timePeriods, error: tpError } = await supabase
        .from('time_periods')
        .select('id, start_at, end_at')
        .eq('job_id', jobId)
        .eq('category', 'crew')

      if (tpError) throw tpError
      if (!timePeriods || timePeriods.length === 0) return []

      const timePeriodIds = timePeriods.map((tp) => tp.id)

      // Get reserved_crew with user info
      const { data: reservedCrew, error: crewError } = await supabase
        .from('reserved_crew')
        .select(
          `
          id,
          user_id,
          time_period_id,
          user:user_id (
            user_id,
            display_name,
            email
          )
        `,
        )
        .in('time_period_id', timePeriodIds)

      if (crewError) throw crewError
      if (!reservedCrew || reservedCrew.length === 0) return []

      // Get user IDs to fetch company_user rates
      const userIds = reservedCrew.map((rc: any) => rc.user_id)

      // Fetch company_user rates for these users
      const { data: companyUsers, error: cuError } = await supabase
        .from('company_user_profiles')
        .select('user_id, role, rate_type, rate')
        .eq('company_id', companyId!)
        .in('user_id', userIds)

      if (cuError) throw cuError

      // Create a map of user_id to company_user data
      const userRatesMap = new Map(
        (companyUsers || []).map((cu: any) => [cu.user_id, cu]),
      )

      // Map to include time period info and rates
      return (reservedCrew || []).map((rc: any) => {
        const timePeriod = timePeriods.find((tp) => tp.id === rc.time_period_id)
        const user = Array.isArray(rc.user) ? rc.user[0] : rc.user
        const companyUser = userRatesMap.get(rc.user_id)

        return {
          id: rc.id,
          user_id: rc.user_id,
          user_name: user?.display_name || user?.email || 'Unknown',
          role: companyUser?.role || null,
          rate_type: companyUser?.rate_type || null,
          rate: companyUser?.rate ? Number(companyUser.rate) : null,
          time_period_id: rc.time_period_id,
          start_at: timePeriod?.start_at || null,
          end_at: timePeriod?.end_at || null,
        }
      })
    },
  })

  // Calculate crew expenses
  const crewExpenses = React.useMemo(() => {
    if (!crewBookings || !companyRates) return []

    return crewBookings
      .map((booking) => {
        if (!booking.start_at || !booking.end_at) return null

        const start = new Date(booking.start_at)
        const end = new Date(booking.end_at)
        const durationMs = end.getTime() - start.getTime()
        const durationHours = durationMs / (1000 * 60 * 60)
        const durationDays = durationHours / 24

        let rate: number | null = null
        let rateType: 'daily' | 'hourly' | null = null

        // Determine rate based on role
        if (booking.role === 'freelancer') {
          // Use individual freelancer rate
          rate = booking.rate
          rateType = booking.rate_type
        } else if (booking.role === 'employee') {
          // Use general employee rates (prefer daily if both exist)
          if (companyRates.employee_daily_rate) {
            rate = Number(companyRates.employee_daily_rate)
            rateType = 'daily'
          } else if (companyRates.employee_hourly_rate) {
            rate = Number(companyRates.employee_hourly_rate)
            rateType = 'hourly'
          }
        } else if (booking.role === 'owner') {
          // Use general owner rates (prefer daily if both exist)
          if (companyRates.owner_daily_rate) {
            rate = Number(companyRates.owner_daily_rate)
            rateType = 'daily'
          } else if (companyRates.owner_hourly_rate) {
            rate = Number(companyRates.owner_hourly_rate)
            rateType = 'hourly'
          }
        }

        if (!rate || !rateType) return null

        // Calculate expense amount
        let amount = 0
        if (rateType === 'daily') {
          amount = rate * Math.ceil(durationDays) // Round up to full days
        } else {
          // hourly
          amount = rate * durationHours
        }

        return {
          id: `crew-${booking.id}`,
          type: 'crew' as const,
          description: `${booking.user_name} (${booking.role || 'unknown'})`,
          amount,
          date: booking.start_at,
          booking,
        }
      })
      .filter((exp): exp is NonNullable<typeof exp> => exp !== null)
  }, [crewBookings, companyRates])

  // Placeholder for expenses from accounting API
  // TODO: Implement actual expense fetching from accounting software
  const accountingExpenses = React.useMemo(() => {
    // For now, return empty array - expenses will be fetched from accounting API
    // when integration is complete
    return []
  }, [])

  // Combine all expenses
  const expenses = React.useMemo(() => {
    return [...crewExpenses, ...accountingExpenses]
  }, [crewExpenses, accountingExpenses])

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
              {crewExpenses.length > 0
                ? `${crewExpenses.length} crew expense${crewExpenses.length !== 1 ? 's' : ''}`
                : accountingConfig?.accounting_organization_id
                  ? 'From accounting software'
                  : 'No expenses yet'}
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

      {/* Crew Expenses Breakdown */}
      {crewExpenses.length > 0 && (
        <Card mb="4">
          <Heading size="4" mb="3">
            Crew Expenses
          </Heading>
          <Flex direction="column" gap="2">
            {crewExpenses.map((expense) => (
              <Flex
                key={expense.id}
                justify="between"
                align="center"
                p="2"
                style={{
                  background: 'var(--gray-a2)',
                  borderRadius: 6,
                }}
              >
                <Flex direction="column" gap="1">
                  <Text weight="medium">{expense.description}</Text>
                  <Text size="1" color="gray">
                    {expense.booking.rate_type === 'daily'
                      ? `${expense.booking.rate?.toFixed(2)} kr per day`
                      : `${expense.booking.rate?.toFixed(2)} kr per hour`}
                    {' · '}
                    {expense.booking.start_at && expense.booking.end_at
                      ? new Date(expense.booking.start_at).toLocaleDateString(
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
                <Text size="4" weight="medium" color="red">
                  {formatCurrency(expense.amount)}
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
