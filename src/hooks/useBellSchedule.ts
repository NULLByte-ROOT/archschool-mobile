import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { fetchSchoolSchedule, qk } from "@/api/client";
import type { SchoolPeriod } from "@/api/types";
import { bellsFrom, type Bell } from "@/lib/bell";

/**
 * Dynamic bell schedule. The web admin writes `GET/PUT /api/schedule`, so
 * refetching on mount/focus keeps the mobile dashboard and timetable in sync
 * with every saved change.
 */
export function useBellSchedule(): {
  periods: SchoolPeriod[];
  bells: Bell[];
  ready: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: qk.schedule,
    queryFn: fetchSchoolSchedule,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const periods = useMemo(
    () =>
      [...(query.data?.periods ?? [])].sort(
        (a, b) => a.period_number - b.period_number
      ),
    [query.data]
  );

  const bells = useMemo(() => bellsFrom(periods), [periods]);

  return {
    periods,
    bells,
    ready: query.isFetched,
    refetch: () => {
      void query.refetch();
    },
  };
}
