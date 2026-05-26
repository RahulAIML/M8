import { useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchActivities, fetchSimulations, fetchMembers, fetchAdmins } from '../api/client'
import {
  computeKPIs,
  computeTrend,
  computeRoundStats,
  computeActivityStats,
  computeUserStats,
  computeScoreDistribution,
  buildOrgTree,
  extractFeedback,
  filterTestUsers,
} from '../lib/analytics'

export function useDashboardData() {
  const activitiesQ = useQuery({ queryKey: ['activities'], queryFn: fetchActivities })
  const simsQ = useQuery({ queryKey: ['simulations'], queryFn: fetchSimulations })
  const membersQ = useQuery({ queryKey: ['members'], queryFn: fetchMembers })
  const adminsQ = useQuery({ queryKey: ['admins'], queryFn: fetchAdmins })

  // Fine-grained loading flags so pages can render as soon as their data arrives
  const simsLoading = simsQ.isLoading
  const activitiesLoading = activitiesQ.isLoading
  const orgLoading = membersQ.isLoading || adminsQ.isLoading
  // Full loading: wait for all four (used by pages that need kpis / org tree)
  const isLoading = simsLoading || activitiesLoading || orgLoading
  const isError = activitiesQ.isError || simsQ.isError || membersQ.isError || adminsQ.isError

  const activities = useMemo(() => activitiesQ.data?.data ?? [], [activitiesQ.data])
  const sims = useMemo(() => filterTestUsers(simsQ.data ?? []), [simsQ.data])
  const members = useMemo(() => membersQ.data?.data ?? [], [membersQ.data])
  const admins = useMemo(() => adminsQ.data?.data ?? [], [adminsQ.data])

  // Analytics — each memoized independently so only the affected slice reruns
  // kpis computes as soon as sims+activities arrive; org counts (members/admins)
  // start at 0 and update when org queries finish — pages that need org counts
  // guard on orgLoading separately.
  const kpis = useMemo(
    () => (simsLoading || activitiesLoading || isError ? null : computeKPIs(sims, activities, members, admins)),
    [simsLoading, activitiesLoading, isError, sims, activities, members, admins],
  )
  const trend = useMemo(
    () => (simsLoading || isError ? null : computeTrend(sims)),
    [simsLoading, isError, sims],
  )
  const roundStats = useMemo(
    () => (simsLoading || isError ? null : computeRoundStats(sims)),
    [simsLoading, isError, sims],
  )
  const actStats = useMemo(
    () => (simsLoading || activitiesLoading || isError ? null : computeActivityStats(sims, activities)),
    [simsLoading, activitiesLoading, isError, sims, activities],
  )
  const userStats = useMemo(
    () => (simsLoading || isError ? null : computeUserStats(sims)),
    [simsLoading, isError, sims],
  )
  const scoreDist = useMemo(
    () => (simsLoading || isError ? null : computeScoreDistribution(sims)),
    [simsLoading, isError, sims],
  )
  const orgTree = useMemo(
    () => (orgLoading || isError ? null : buildOrgTree(admins, members)),
    [orgLoading, isError, admins, members],
  )
  const feedback = useMemo(
    () => (simsLoading || isError ? null : extractFeedback(sims)),
    [simsLoading, isError, sims],
  )

  const refetch = useCallback(() => {
    activitiesQ.refetch()
    simsQ.refetch()
    membersQ.refetch()
    adminsQ.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    isLoading,
    simsLoading,
    activitiesLoading,
    orgLoading,
    isError,
    activities,
    sims,
    members,
    admins,
    kpis,
    trend,
    roundStats,
    actStats,
    userStats,
    scoreDist,
    orgTree,
    feedback,
    refetch,
  }
}
