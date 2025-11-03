// src/pages/Home.tsx
import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Select,
  Separator,
  Spinner,
  Switch,
  Text,
} from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  Building,
  Eye,
  GoogleDocs,
  Message,
  RssFeed,
  Wallet,
} from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { supabase } from '@shared/api/supabase'
import { formatDistanceToNow } from 'date-fns'
import { jobsIndexQuery } from '@features/jobs/api/queries'
import { latestFeedQuery } from '@features/latest/api/queries'
import { mattersIndexQuery } from '@features/matters/api/queries'
import { incomeAndExpensesQuery } from '@features/home/api/queries'
import { IncomeExpensesChart } from '@shared/ui/components/IncomeExpensesChart'
import { groupInventoryActivities } from '@features/latest/utils/groupInventoryActivities'
import type {
  ActivityFeedItem,
  GroupedInventoryActivity,
} from '@features/latest/types'

export default function HomePage() {
  const { companyId } = useCompany()
  const { userId, companyRole, caps } = useAuthz()
  const navigate = useNavigate()

  // Calculate date range for next 14 days
  const now = new Date()
  const fourteenDaysFromNow = new Date(now)
  fourteenDaysFromNow.setDate(now.getDate() + 14)

  // Fetch upcoming jobs
  const isFreelancer = companyRole === 'freelancer'
  const canSeeLatest = caps.has('visit:latest')
  const [showMyJobsOnly, setShowMyJobsOnly] = React.useState(false)
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    ...jobsIndexQuery({
      companyId: companyId ?? '',
      search: '',
      sortBy: 'start_at',
      sortDir: 'asc',
      userId: userId ?? null,
      companyRole: companyRole ?? null,
    }),
    enabled: !!companyId,
  })

  // Filter jobs for next 14 days
  const upcomingJobs = React.useMemo(() => {
    if (!jobsData) return []
    return jobsData.filter((job) => {
      if (!job.start_at) return false
      const startDate = new Date(job.start_at)
      return startDate >= now && startDate <= fourteenDaysFromNow
    })
  }, [jobsData, now, fourteenDaysFromNow])

  // Filter to show only my jobs if toggle is on (but not for freelancers - they're already filtered)
  const filteredUpcomingJobs = React.useMemo(() => {
    // Freelancers are already filtered server-side to only show their booked jobs
    if (isFreelancer) return upcomingJobs
    // For others, respect the toggle
    if (!showMyJobsOnly || !userId) return upcomingJobs
    return upcomingJobs.filter((job) => job.project_lead?.user_id === userId)
  }, [upcomingJobs, showMyJobsOnly, userId, isFreelancer])

  // Fetch unread matters
  const { data: mattersData, isLoading: mattersLoading } = useQuery({
    ...mattersIndexQuery(companyId ?? ''),
    enabled: !!companyId,
  })

  const unreadMatters = React.useMemo(() => {
    if (!mattersData) return []
    return mattersData.filter((matter) => matter.is_unread)
  }, [mattersData])

  // Fetch latest activity feed
  const { data: latestData, isLoading: latestLoading } = useQuery({
    ...latestFeedQuery({
      companyId: companyId ?? '',
      limit: 10,
    }),
    enabled: !!companyId && canSeeLatest,
  })

  // Check if accounting system is configured
  const { data: accountingConfig, isLoading: accountingLoading } = useQuery({
    queryKey: ['company', companyId, 'accounting-config'],
    enabled: !!companyId && !isFreelancer,
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('company_expansions')
        .select(
          'accounting_software, accounting_api_key_encrypted, accounting_organization_id',
        )
        .eq('company_id', companyId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const hasAccountingSystem =
    accountingConfig?.accounting_software === 'conta' &&
    accountingConfig.accounting_api_key_encrypted !== null

  // Get current year for revenue data
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = React.useState(currentYear)
  const [chartType, setChartType] = React.useState<
    'bar' | 'line' | 'area' | 'composed'
  >('area')

  // Generate list of years (current year and 4 previous years)
  const availableYears = React.useMemo(() => {
    const years = []
    for (let i = 0; i < 5; i++) {
      years.push(currentYear - i)
    }
    return years
  }, [currentYear])

  // Fetch income and expenses data
  // The query will attempt to get the organization ID automatically if not provided
  const { data: incomeExpensesData, isLoading: incomeExpensesLoading } =
    useQuery({
      ...incomeAndExpensesQuery(companyId, null, selectedYear),
      enabled: hasAccountingSystem && !!companyId, // Only fetch if accounting system is configured and companyId is available
    })

  const handleLatestClick = (activityId: string) => {
    navigate({
      to: '/latest',
      search: { activityId },
    })
  }

  const getInitials = (name: string | null, email: string): string => {
    if (name) {
      const parts = name.trim().split(/\s+/)
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    return email.substring(0, 2).toUpperCase()
  }

  const getAvatarUrl = (avatarPath: string | null): string | null => {
    if (!avatarPath) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
    return data.publicUrl
  }

  // Responsive toggle for >= 1024px (large screens)
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )

  // Resize state: track left panel width as percentage (default 50% for 1fr/1fr ratio)
  const [leftPanelWidth, setLeftPanelWidth] = React.useState<number>(50)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    // Safari <14 fallback
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  // Handle mouse move for resizing
  React.useEffect(() => {
    if (!isResizing) return

    let rafId: number | null = null
    let pendingWidth: number | null = null

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width

      // Calculate mouse position relative to container
      const mouseX = e.clientX - containerRect.left

      // Calculate new left panel width percentage
      // Min 25%, Max 75% to prevent panels from getting too small
      const minWidth = 25
      const maxWidth = 75
      const newWidthPercent = Math.max(
        minWidth,
        Math.min(maxWidth, (mouseX / containerWidth) * 100),
      )

      pendingWidth = newWidthPercent

      // Use requestAnimationFrame to batch updates and prevent infinite loops
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (pendingWidth !== null) {
            setLeftPanelWidth(pendingWidth)
            pendingWidth = null
          }
          rafId = null
        })
      }
    }

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (pendingWidth !== null) {
        setLeftPanelWidth(pendingWidth)
        pendingWidth = null
      }
      setIsResizing(false)
      // Restore cursor and text selection
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // Set global cursor and prevent text selection during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // Cleanup in case component unmounts during resize
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Inject scroll button animation styles (shared by both UpcomingJobsSection and LatestSection)
  React.useEffect(() => {
    const styleId = 'scroll-button-animation'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes scrollButtonBounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-4px);
        }
      }
    `
    document.head.appendChild(style)

    return () => {
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        existingStyle.remove()
      }
    }
  }, [])

  if (!companyId) {
    return (
      <Box p="4">
        <Text>Please select a company</Text>
      </Box>
    )
  }

  // On small screens, use Grid layout (stack)
  if (!isLarge) {
    return (
      <Box style={{ width: '100%', height: '100%' }}>
        <Grid columns="1fr" gap="4" style={{ height: '100%' }}>
          {/* Left Column: Revenue and Upcoming Jobs */}
          <Flex direction="column" gap="4" style={{ height: '100%' }}>
            {!isFreelancer && (
              <Box style={{ flex: 3, minHeight: 0 }}>
                <RevenueSection
                  hasAccountingSystem={hasAccountingSystem}
                  loading={accountingLoading}
                  isOwner={companyRole === 'owner'}
                  incomeExpensesData={incomeExpensesData}
                  incomeExpensesLoading={incomeExpensesLoading}
                  selectedYear={selectedYear}
                  availableYears={availableYears}
                  onYearChange={setSelectedYear}
                  chartType={chartType}
                  onChartTypeChange={setChartType}
                  accountingSoftware={accountingConfig?.accounting_software}
                  accountingOrganizationId={
                    accountingConfig?.accounting_organization_id
                  }
                />
              </Box>
            )}
            <Box style={{ flex: 2, minHeight: 0 }}>
              <UpcomingJobsSection
                jobs={filteredUpcomingJobs}
                loading={jobsLoading}
                showMyJobsOnly={showMyJobsOnly}
                onToggleMyJobsOnly={setShowMyJobsOnly}
                getInitials={getInitials}
                getAvatarUrl={getAvatarUrl}
                isFreelancer={isFreelancer}
              />
            </Box>
          </Flex>

          {/* Right Column: Notifications and Latest */}
          <Flex direction="column" gap="4" style={{ height: '100%' }}>
            {unreadMatters.length > 0 && (
              <Box style={{ minHeight: 0 }}>
                <MattersSection
                  matters={unreadMatters}
                  loading={mattersLoading}
                  getInitials={getInitials}
                  getAvatarUrl={getAvatarUrl}
                />
              </Box>
            )}
            {canSeeLatest && (
              <Box style={{ flex: 1, minHeight: 0 }}>
                <LatestSection
                  activities={latestData?.items || []}
                  loading={latestLoading}
                  onActivityClick={handleLatestClick}
                  getInitials={getInitials}
                  getAvatarUrl={getAvatarUrl}
                />
              </Box>
            )}
          </Flex>
        </Grid>
      </Box>
    )
  }

  // On large screens, use resizable flex layout
  return (
    <Box
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        position: 'relative',
      }}
    >
      <Flex
        direction="row"
        gap="2"
        align="stretch"
        style={{
          height: '100%',
          minHeight: 0,
        }}
      >
        {/* Left Column: Revenue and Upcoming Jobs */}
        <Flex
          direction="column"
          gap="4"
          style={{
            width: `${leftPanelWidth}%`,
            height: '100%',
            minWidth: '300px',
            maxWidth: '75%',
            minHeight: 0,
            flexShrink: 0,
            transition: isResizing ? 'none' : 'width 0.1s ease-out',
          }}
        >
          {!isFreelancer && (
            <Box style={{ flex: 3, minHeight: 0 }}>
              <RevenueSection
                hasAccountingSystem={hasAccountingSystem}
                loading={accountingLoading}
                isOwner={companyRole === 'owner'}
                incomeExpensesData={incomeExpensesData}
                incomeExpensesLoading={incomeExpensesLoading}
                selectedYear={selectedYear}
                availableYears={availableYears}
                onYearChange={setSelectedYear}
                chartType={chartType}
                onChartTypeChange={setChartType}
                accountingSoftware={accountingConfig?.accounting_software}
                accountingOrganizationId={
                  accountingConfig?.accounting_organization_id
                }
              />
            </Box>
          )}
          <Box style={{ flex: 2, minHeight: 0 }}>
            <UpcomingJobsSection
              jobs={filteredUpcomingJobs}
              loading={jobsLoading}
              showMyJobsOnly={showMyJobsOnly}
              onToggleMyJobsOnly={setShowMyJobsOnly}
              getInitials={getInitials}
              getAvatarUrl={getAvatarUrl}
              isFreelancer={isFreelancer}
            />
          </Box>
        </Flex>

        {/* RESIZER */}
        <Box
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizing(true)
          }}
          style={{
            width: '6px',
            height: '15%',
            cursor: 'col-resize',
            backgroundColor: 'var(--gray-a4)',
            borderRadius: '4px',
            flexShrink: 0,
            alignSelf: 'center',
            userSelect: 'none',
            margin: '0 -4px', // Extend into gap for easier clicking
            zIndex: 10,
            transition: isResizing ? 'none' : 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a6)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = 'var(--gray-a4)'
            }
          }}
        />

        {/* Right Column: Notifications and Latest */}
        <Flex
          direction="column"
          gap="4"
          style={{
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            minWidth: '300px',
            minHeight: 0,
            transition: isResizing ? 'none' : 'flex-basis 0.1s ease-out',
          }}
        >
          {unreadMatters.length > 0 && (
            <Box style={{ minHeight: 0 }}>
              <MattersSection
                matters={unreadMatters}
                loading={mattersLoading}
                getInitials={getInitials}
                getAvatarUrl={getAvatarUrl}
              />
            </Box>
          )}
          {canSeeLatest && (
            <Box style={{ flex: 1, minHeight: 0 }}>
              <LatestSection
                activities={latestData?.items || []}
                loading={latestLoading}
                onActivityClick={handleLatestClick}
                getInitials={getInitials}
                getAvatarUrl={getAvatarUrl}
              />
            </Box>
          )}
        </Flex>
      </Flex>
    </Box>
  )
}

function RevenueSection({
  hasAccountingSystem,
  loading,
  isOwner,
  incomeExpensesData,
  incomeExpensesLoading,
  selectedYear,
  availableYears,
  onYearChange,
  chartType,
  onChartTypeChange,
  accountingSoftware,
  accountingOrganizationId: _accountingOrganizationId,
}: {
  hasAccountingSystem: boolean
  loading: boolean
  isOwner: boolean
  incomeExpensesData:
    | {
        sumIncome?: number
        sumExpenses?: number
        sumResult?: number
        income?: Array<string>
        expenses?: Array<string>
        result?: Array<string>
      }
    | null
    | undefined
  incomeExpensesLoading: boolean
  selectedYear: number
  availableYears: Array<number>
  onYearChange: (year: number) => void
  chartType: 'bar' | 'line' | 'area' | 'composed'
  onChartTypeChange: (type: 'bar' | 'line' | 'area' | 'composed') => void
  accountingSoftware?: string | null
  accountingOrganizationId?: string | null
}) {
  const navigate = useNavigate()
  const [logoError, setLogoError] = React.useState(false)

  const showConfigureButton = isOwner && !hasAccountingSystem

  // Get accounting system URL
  const getAccountingSystemUrl = () => {
    if (accountingSoftware === 'conta') {
      // Conta website URL - can include organization ID if needed
      return 'https://conta.no'
    }
    return null
  }

  const accountingSystemUrl = getAccountingSystemUrl()

  // Transform API data into chart format
  const chartData = React.useMemo(() => {
    if (
      !incomeExpensesData ||
      !incomeExpensesData.income ||
      !incomeExpensesData.expenses
    ) {
      return []
    }

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]

    return monthNames.map((month, index) => ({
      month,
      income: parseFloat(incomeExpensesData.income?.[index] || '0'),
      expenses: parseFloat(incomeExpensesData.expenses?.[index] || '0'),
    }))
  }, [incomeExpensesData])

  // Format currency for KPI display
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '--'
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <DashboardCard
      title="Revenue"
      icon={<Wallet width={18} height={18} />}
      headerAction={
        hasAccountingSystem ? (
          <Flex gap="2" align="center">
            <Select.Root
              value={chartType}
              onValueChange={(value) =>
                onChartTypeChange(value as 'bar' | 'line' | 'area' | 'composed')
              }
            >
              <Select.Trigger variant="soft">
                <Eye width={16} height={16} />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="bar">Bar</Select.Item>
                <Select.Item value="line">Line</Select.Item>
                <Select.Item value="area">Area</Select.Item>
                <Select.Item value="composed">Composed</Select.Item>
              </Select.Content>
            </Select.Root>
            <Select.Root
              value={selectedYear.toString()}
              onValueChange={(value) => onYearChange(parseInt(value, 10))}
            >
              <Select.Trigger variant="soft" />
              <Select.Content>
                {availableYears.map((year) => (
                  <Select.Item key={year} value={year.toString()}>
                    {year}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        ) : undefined
      }
      footer={
        showConfigureButton ? (
          <Button
            size="2"
            variant="soft"
            onClick={() =>
              navigate({ to: '/company', search: { tab: 'expansions' } })
            }
          >
            Configure
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : hasAccountingSystem ? (
        <Box style={{ height: '100%', position: 'relative' }}>
          {incomeExpensesLoading ? (
            <Flex
              align="center"
              justify="center"
              py="6"
              style={{ height: '100%' }}
            >
              <Spinner size="2" />
            </Flex>
          ) : (
            <>
              <Flex gap="4" style={{ height: '100%', minHeight: 0 }}>
                {/* Chart on the left */}
                <Box
                  style={{ flex: 1, minWidth: 0, height: '100%', minHeight: 0 }}
                >
                  <IncomeExpensesChart
                    data={chartData}
                    chartType={chartType}
                    onChartTypeChange={onChartTypeChange}
                  />
                </Box>
                {/* KPIs on the right */}
                <Box style={{ width: '160px', minWidth: '160px' }}>
                  <Flex direction="column" gap="3">
                    <Flex
                      direction="column"
                      gap="3"
                      style={{
                        padding: '12px',
                        background: 'var(--gray-2)',
                        borderRadius: '8px',
                        height: 'fit-content',
                      }}
                    >
                      <KPI
                        label={`${selectedYear} Revenue`}
                        value={formatCurrency(incomeExpensesData?.sumIncome)}
                      />
                      <Separator />
                      <KPI
                        label={`${selectedYear} Expenses`}
                        value={formatCurrency(incomeExpensesData?.sumExpenses)}
                      />
                      <Separator />
                      <KPI
                        label="Net Profit"
                        value={formatCurrency(incomeExpensesData?.sumResult)}
                        highlight
                      />
                    </Flex>
                  </Flex>
                </Box>
              </Flex>
              {/* Accounting system redirect button - bottom right */}
              {accountingSystemUrl && (
                <Button
                  size="2"
                  variant="soft"
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    zIndex: 10,
                  }}
                  onClick={() => {
                    window.open(
                      accountingSystemUrl,
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }}
                >
                  {accountingSoftware === 'conta' ? (
                    logoError ? (
                      <Building width={18} height={18} />
                    ) : (
                      <img
                        src="https://conta.no/favicon.ico"
                        alt="Conta"
                        style={{
                          width: '18px',
                          height: '18px',
                          objectFit: 'contain',
                        }}
                        onError={() => setLogoError(true)}
                      />
                    )
                  ) : (
                    <Building width={18} height={18} />
                  )}
                  <Text size="2" weight="medium">
                    {accountingSoftware === 'conta' ? 'Conta' : 'Accounting'}
                  </Text>
                </Button>
              )}
            </>
          )}
        </Box>
      ) : (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            No accounting system configured
          </Text>
        </Box>
      )}
    </DashboardCard>
  )
}

function UpcomingJobsSection({
  jobs,
  loading,
  showMyJobsOnly,
  onToggleMyJobsOnly,
  getInitials,
  getAvatarUrl,
  isFreelancer,
}: {
  jobs: Array<{
    id: string
    title: string
    status: string
    start_at: string | null
    end_at: string | null
    customer?: {
      id: string
      name: string | null
    } | null
    project_lead?: {
      user_id: string
      display_name: string | null
      email: string
      avatar_url: string | null
    } | null
  }>
  loading: boolean
  showMyJobsOnly: boolean
  onToggleMyJobsOnly: (value: boolean) => void
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
  isFreelancer: boolean
}) {
  const navigate = useNavigate()
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [showScrollIndicator, setShowScrollIndicator] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  // Limit to 5 jobs
  const displayJobs = jobs.slice(0, 5)

  // Check if scrolling is needed - the scrollable parent is DashboardCard's Box (direct parent)
  React.useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        // The scrollable parent is the direct parent (DashboardCard's Box with overflowY: auto)
        const scrollableParent = scrollContainerRef.current.parentElement

        if (scrollableParent) {
          const { scrollTop, scrollHeight, clientHeight } = scrollableParent
          const isScrollable = scrollHeight > clientHeight
          const isNotAtBottom = scrollTop + clientHeight < scrollHeight - 10
          setShowScrollIndicator(isScrollable && isNotAtBottom)
        }
      }
    }

    // Check after a brief delay to ensure DOM is rendered
    const timeoutId = setTimeout(checkScroll, 100)
    const container = scrollContainerRef.current
    if (container) {
      // The scrollable parent is the direct parent (DashboardCard's Box)
      const scrollableParent = container.parentElement

      if (scrollableParent) {
        scrollableParent.addEventListener('scroll', checkScroll)
        window.addEventListener('resize', checkScroll)
        const parent = scrollableParent // Capture for cleanup
        return () => {
          clearTimeout(timeoutId)
          parent.removeEventListener('scroll', checkScroll)
          window.removeEventListener('resize', checkScroll)
        }
      }
    }
    return () => clearTimeout(timeoutId)
  }, [displayJobs])

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      // The scrollable parent is the direct parent (DashboardCard's Box)
      const scrollableParent = scrollContainerRef.current.parentElement

      if (scrollableParent) {
        scrollableParent.scrollTo({
          top: scrollableParent.scrollHeight,
          behavior: 'smooth',
        })
      }
    }
  }

  return (
    <DashboardCard
      title="Upcoming Jobs"
      icon={<GoogleDocs width={18} height={18} />}
      footer={
        !isFreelancer ? (
          <Flex
            gap="2"
            align="center"
            justify="between"
            style={{ width: '100%' }}
          >
            <Text size="1" color="gray">
              Next 14 days
            </Text>
            <Flex gap="2" align="center">
              <Text size="1" color="gray">
                My jobs only
              </Text>
              <Switch
                checked={showMyJobsOnly}
                onCheckedChange={onToggleMyJobsOnly}
                size="1"
              />
            </Flex>
          </Flex>
        ) : (
          <Text size="1" color="gray">
            Next 14 days
          </Text>
        )
      }
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : jobs.length === 0 ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            {isFreelancer
              ? 'No jobs booked in the next 14 days'
              : 'No upcoming jobs in the next 14 days'}
          </Text>
        </Box>
      ) : (
        <Box
          ref={scrollContainerRef}
          style={{ position: 'relative', height: '100%' }}
        >
          <Flex direction="column" gap="2">
            {displayJobs.map((job) => {
              const avatarUrl = getAvatarUrl(
                job.project_lead?.avatar_url ?? null,
              )
              const displayName =
                job.project_lead?.display_name ||
                job.project_lead?.email ||
                'Unassigned'
              const initials = getInitials(
                job.project_lead?.display_name ?? null,
                displayName,
              )
              const customerName = job.customer?.name || 'No customer'

              return (
                <div
                  key={job.id}
                  style={{
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    transition: 'background-color 0.15s',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() =>
                    navigate({
                      to: '/jobs',
                      search: { jobId: job.id, tab: undefined },
                    })
                  }
                >
                  <Flex gap="2" align="center" justify="between">
                    <Flex
                      direction="column"
                      gap="1"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <Text size="2" weight="medium">
                        {job.title}
                      </Text>
                      <Flex gap="2" align="center">
                        <Text size="2" color="gray" weight="medium">
                          {customerName}
                        </Text>
                        <Text size="1" color="gray">
                          •
                        </Text>
                        <Text size="1" color="gray">
                          {job.start_at
                            ? formatDistanceToNow(new Date(job.start_at), {
                                addSuffix: true,
                              })
                            : 'No date set'}
                        </Text>
                      </Flex>
                    </Flex>
                    <Flex gap="2" align="center" style={{ flexShrink: 0 }}>
                      <Text size="1" color="gray">
                        {displayName}
                      </Text>
                      <Avatar
                        size="2"
                        src={avatarUrl || undefined}
                        fallback={initials}
                        radius="full"
                      />
                    </Flex>
                  </Flex>
                </div>
              )
            })}
          </Flex>
          {showScrollIndicator && (
            <Button
              size="1"
              variant="ghost"
              style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isHovered
                  ? '0 4px 12px rgba(0, 0, 0, 0.2)'
                  : '0 2px 8px rgba(0, 0, 0, 0.15)',
                backgroundColor: isHovered ? 'var(--gray-4)' : 'var(--gray-3)',
                color: 'var(--gray-11)',
                cursor: 'pointer',
                zIndex: 10,
                animation: 'scrollButtonBounce 2s ease-in-out infinite',
                transition:
                  'background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={scrollToBottom}
              aria-label="Scroll to bottom"
            >
              <ArrowDown width={16} height={16} />
            </Button>
          )}
        </Box>
      )}
    </DashboardCard>
  )
}

function MattersSection({
  matters,
  loading,
  getInitials,
  getAvatarUrl,
}: {
  matters: Array<{
    id: string
    title: string
    matter_type: 'crew_invite' | 'vote' | 'announcement' | 'chat'
    created_at: string
    created_by?: {
      user_id: string
      display_name: string | null
      email: string
      avatar_url: string | null
    } | null
  }>
  loading: boolean
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
}) {
  const navigate = useNavigate()

  const getMatterTypeLabel = (
    type: 'crew_invite' | 'vote' | 'announcement' | 'chat',
  ): string => {
    switch (type) {
      case 'vote':
        return 'Vote'
      case 'chat':
        return 'Chat'
      case 'crew_invite':
        return 'Invite'
      case 'announcement':
        return 'Announcement'
      default:
        return type
    }
  }

  const getMatterTypeColor = (
    type: 'crew_invite' | 'vote' | 'announcement' | 'chat',
  ): 'blue' | 'purple' | 'green' | 'orange' => {
    switch (type) {
      case 'vote':
        return 'purple'
      case 'chat':
        return 'blue'
      case 'crew_invite':
        return 'green'
      case 'announcement':
        return 'orange'
      default:
        return 'blue'
    }
  }

  return (
    <DashboardCard
      title="Matters"
      icon={<Message width={18} height={18} />}
      footer={
        <Button
          size="2"
          variant="soft"
          onClick={() => navigate({ to: '/matters' })}
        >
          View all
        </Button>
      }
      notFullHeight
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : matters.length === 0 ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            No unread matters
          </Text>
        </Box>
      ) : (
        <Flex direction="column" gap="2">
          {matters.slice(0, 5).map((matter) => {
            if (!matter.created_by) return null
            const avatarUrl = getAvatarUrl(matter.created_by.avatar_url)
            const initials = getInitials(
              matter.created_by.display_name,
              matter.created_by.email,
            )

            return (
              <React.Fragment key={matter.id}>
                <div
                  style={{
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    transition: 'background-color 0.15s',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() => navigate({ to: '/matters' })}
                >
                  <Flex gap="2" align="center">
                    <Avatar
                      size="2"
                      src={avatarUrl || undefined}
                      fallback={initials}
                      radius="full"
                    />
                    <Box style={{ flex: 1 }}>
                      <Text size="2" weight="medium">
                        {matter.title}
                      </Text>
                      <Flex gap="2" align="center">
                        <Text size="1" color="gray">
                          {matter.created_by.display_name ||
                            matter.created_by.email}
                        </Text>
                        <Text size="1" color="gray">
                          •
                        </Text>
                        <Badge
                          size="1"
                          color={getMatterTypeColor(matter.matter_type)}
                          variant="soft"
                        >
                          {getMatterTypeLabel(matter.matter_type)}
                        </Badge>
                        <Text size="1" color="gray">
                          •
                        </Text>
                        <Text size="1" color="gray">
                          {formatDistanceToNow(new Date(matter.created_at), {
                            addSuffix: true,
                          })}
                        </Text>
                      </Flex>
                    </Box>
                  </Flex>
                </div>
              </React.Fragment>
            )
          })}
        </Flex>
      )}
    </DashboardCard>
  )
}

function LatestSection({
  activities,
  loading,
  onActivityClick,
  getInitials,
  getAvatarUrl,
}: {
  activities: Array<ActivityFeedItem>
  loading: boolean
  onActivityClick: (id: string) => void
  getInitials: (name: string | null, email: string) => string
  getAvatarUrl: (avatarPath: string | null) => string | null
}) {
  const navigate = useNavigate()
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [showScrollIndicator, setShowScrollIndicator] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  // Group inventory activities
  const groupedActivities = React.useMemo(
    () => groupInventoryActivities(activities),
    [activities],
  )

  // Limit to 10 activities
  const displayActivities = groupedActivities.slice(0, 10)

  // Check if scrolling is needed - the scrollable parent is DashboardCard's Box (direct parent)
  React.useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        // The scrollable parent is the direct parent (DashboardCard's Box with overflowY: auto)
        const scrollableParent = scrollContainerRef.current.parentElement

        if (scrollableParent) {
          const { scrollTop, scrollHeight, clientHeight } = scrollableParent
          const isScrollable = scrollHeight > clientHeight
          const isNotAtBottom = scrollTop + clientHeight < scrollHeight - 10
          setShowScrollIndicator(isScrollable && isNotAtBottom)
        }
      }
    }

    // Check after a brief delay to ensure DOM is rendered
    const timeoutId = setTimeout(checkScroll, 100)
    const container = scrollContainerRef.current
    if (container) {
      // The scrollable parent is the direct parent (DashboardCard's Box)
      const scrollableParent = container.parentElement

      if (scrollableParent) {
        scrollableParent.addEventListener('scroll', checkScroll)
        window.addEventListener('resize', checkScroll)
        const parent = scrollableParent // Capture for cleanup
        return () => {
          clearTimeout(timeoutId)
          parent.removeEventListener('scroll', checkScroll)
          window.removeEventListener('resize', checkScroll)
        }
      }
    }
    return () => clearTimeout(timeoutId)
  }, [displayActivities])

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      // The scrollable parent is the direct parent (DashboardCard's Box)
      const scrollableParent = scrollContainerRef.current.parentElement

      if (scrollableParent) {
        scrollableParent.scrollTo({
          top: scrollableParent.scrollHeight,
          behavior: 'smooth',
        })
      }
    }
  }

  const getActivityIcon = (
    activity: ActivityFeedItem | GroupedInventoryActivity,
  ): { icon: string; bgColor: string } => {
    // Handle grouped inventory activities
    if ('isGrouped' in activity) {
      if (activity.activity_type === 'inventory_items_grouped') {
        return { icon: '📦', bgColor: 'var(--blue-3)' }
      }
      if (activity.activity_type === 'inventory_groups_grouped') {
        return { icon: '📁', bgColor: 'var(--purple-3)' }
      }
      // Mixed (items and groups)
      return { icon: '📦', bgColor: 'var(--blue-3)' }
    }

    // Handle regular activities
    const regularActivity: ActivityFeedItem = activity

    switch (regularActivity.activity_type) {
      case 'inventory_item_created':
      case 'inventory_item_deleted':
        return { icon: '📦', bgColor: 'var(--blue-3)' }
      case 'inventory_group_created':
      case 'inventory_group_deleted':
        return { icon: '📁', bgColor: 'var(--purple-3)' }
      case 'vehicle_added':
      case 'vehicle_removed':
        return { icon: '🚗', bgColor: 'var(--green-3)' }
      case 'customer_added':
      case 'customer_removed':
        return { icon: '👤', bgColor: 'var(--orange-3)' }
      case 'crew_added':
      case 'crew_removed':
        return { icon: '👷', bgColor: 'var(--yellow-3)' }
      case 'job_created':
      case 'job_status_changed':
      case 'job_deleted':
        return { icon: '📋', bgColor: 'var(--indigo-3)' }
      case 'announcement':
        return { icon: '📢', bgColor: 'var(--red-3)' }
      default:
        return { icon: '📌', bgColor: 'var(--gray-3)' }
    }
  }

  const formatActivityTitle = (
    activity: ActivityFeedItem | GroupedInventoryActivity,
  ): string => {
    // Handle grouped inventory activities
    if ('isGrouped' in activity) {
      const parts: Array<string> = []
      if (activity.item_count > 0) {
        parts.push(
          `${activity.item_count} ${activity.item_count === 1 ? 'item' : 'items'}`,
        )
      }
      if (activity.group_count > 0) {
        parts.push(
          `${activity.group_count} ${activity.group_count === 1 ? 'group' : 'groups'}`,
        )
      }
      return `Added ${parts.join(' and ')} to inventory`
    }

    // Handle regular activities
    const regularActivity: ActivityFeedItem = activity
    const metadata = regularActivity.metadata

    switch (regularActivity.activity_type) {
      case 'inventory_item_created':
        return `Added "${metadata.item_name || 'item'}" to inventory`
      case 'inventory_item_deleted':
        return `Removed "${metadata.item_name || 'item'}" from inventory`
      case 'inventory_group_created':
        return `Created inventory group "${metadata.group_name || 'group'}"`
      case 'inventory_group_deleted':
        return `Removed inventory group "${metadata.group_name || 'group'}"`
      case 'vehicle_added':
        return `Added vehicle "${metadata.vehicle_name || metadata.license_plate || 'vehicle'}"`
      case 'vehicle_removed':
        return `Removed vehicle "${metadata.vehicle_name || metadata.license_plate || 'vehicle'}"`
      case 'customer_added':
        return `Added customer "${metadata.customer_name || 'customer'}"`
      case 'customer_removed':
        return `Removed customer "${metadata.customer_name || 'customer'}"`
      case 'crew_added':
        return `Added crew member "${metadata.user_name || metadata.email || 'crew'}"`
      case 'crew_removed':
        return `Removed crew member "${metadata.user_name || metadata.email || 'crew'}"`
      case 'job_created':
        return `Created job "${metadata.job_title || regularActivity.title || 'job'}"`
      case 'job_status_changed':
        return `Changed job "${metadata.job_title || regularActivity.title || 'job'}" status`
      case 'job_deleted':
        return `Deleted job "${metadata.job_title || regularActivity.title || 'job'}"`
      case 'announcement':
        return regularActivity.title || 'Announcement'
      default:
        return regularActivity.title || 'Activity'
    }
  }

  return (
    <DashboardCard
      title="Latest"
      icon={<RssFeed width={18} height={18} />}
      footer={
        <Button
          size="2"
          variant="soft"
          onClick={() =>
            navigate({ to: '/latest', search: { activityId: undefined } })
          }
        >
          View all
        </Button>
      }
    >
      {loading ? (
        <Flex align="center" justify="center" py="4">
          <Spinner size="2" />
        </Flex>
      ) : groupedActivities.length === 0 ? (
        <Box py="4">
          <Text size="2" color="gray" align="center">
            No recent activity
          </Text>
        </Box>
      ) : (
        <Box
          ref={scrollContainerRef}
          style={{ position: 'relative', height: '100%' }}
        >
          <Flex direction="column" gap="2">
            {displayActivities.map((activity) => {
              const displayName =
                activity.created_by.display_name || activity.created_by.email
              const avatarUrl = getAvatarUrl(activity.created_by.avatar_url)
              const initials = getInitials(
                activity.created_by.display_name,
                activity.created_by.email,
              )

              return (
                <div
                  key={activity.id}
                  style={{
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    transition: 'background-color 0.15s',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() => onActivityClick(activity.id)}
                >
                  <Flex gap="3" align="center" justify="between">
                    <Flex
                      gap="3"
                      align="center"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <Text size="3" style={{ flexShrink: 0 }}>
                        {getActivityIcon(activity).icon}
                      </Text>
                      <Flex
                        direction="column"
                        gap="1"
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <Text size="2" weight="medium">
                          {formatActivityTitle(activity)}
                        </Text>
                        <Text size="1" color="gray">
                          {formatDistanceToNow(new Date(activity.created_at), {
                            addSuffix: true,
                          })}
                        </Text>
                      </Flex>
                    </Flex>
                    <Flex gap="2" align="center" style={{ flexShrink: 0 }}>
                      <Text size="1" color="gray">
                        {displayName}
                      </Text>
                      <Avatar
                        size="2"
                        src={avatarUrl || undefined}
                        fallback={initials}
                        radius="full"
                      />
                    </Flex>
                  </Flex>
                </div>
              )
            })}
          </Flex>
          {showScrollIndicator && (
            <Button
              size="1"
              variant="ghost"
              style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isHovered
                  ? '0 4px 12px rgba(0, 0, 0, 0.2)'
                  : '0 2px 8px rgba(0, 0, 0, 0.15)',
                backgroundColor: isHovered ? 'var(--gray-4)' : 'var(--gray-3)',
                color: 'var(--gray-11)',
                cursor: 'pointer',
                zIndex: 10,
                animation: 'scrollButtonBounce 2s ease-in-out infinite',
                transition:
                  'background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={scrollToBottom}
              aria-label="Scroll to bottom"
            >
              <ArrowDown width={16} height={16} />
            </Button>
          )}
        </Box>
      )}
    </DashboardCard>
  )
}

function DashboardCard({
  title,
  icon,
  children,
  footer,
  headerAction,
  notFullHeight,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  headerAction?: React.ReactNode
  notFullHeight?: boolean
}) {
  return (
    <Card size="3" style={notFullHeight ? undefined : { height: '100%' }}>
      <Flex
        direction="column"
        gap="3"
        style={notFullHeight ? undefined : { height: '100%' }}
      >
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            <IconBadge>{icon}</IconBadge>
            <Heading size="4">{title}</Heading>
          </Flex>
          {headerAction && <Box>{headerAction}</Box>}
        </Flex>

        <Box
          style={
            notFullHeight
              ? undefined
              : { flex: 1, minHeight: 0, overflowY: 'auto' }
          }
        >
          {children}
        </Box>

        {footer && (
          <>
            <Separator my="2" />
            <Flex justify="end">{footer}</Flex>
          </>
        )}
      </Flex>
    </Card>
  )
}

function KPI({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <Flex direction="column" gap="1">
      <Text color="gray" size={highlight ? '2' : '1'} weight="medium">
        {label}
      </Text>
      <Text
        weight="bold"
        size={highlight ? '5' : '4'}
        style={{ lineHeight: 1.2 }}
      >
        {value}
      </Text>
    </Flex>
  )
}

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <Flex
      align="center"
      justify="center"
      width="32px"
      height="32px"
      style={{
        borderRadius: 8,
        background: 'var(--accent-3)',
        color: 'var(--accent-11)',
      }}
    >
      <Box style={{ lineHeight: 0 }}>{children}</Box>
    </Flex>
  )
}
