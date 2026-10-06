import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_OPERATING_PERIODS, type OperatingPeriodsDTO } from "@/types/operatingPeriods";

type Ctx = {
  data: OperatingPeriodsDTO;
  loading: boolean;
  refresh: () => Promise<void>;
};

const OperatingPeriodsContext = createContext<Ctx | null>(null);

export function OperatingPeriodsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OperatingPeriodsDTO>(DEFAULT_OPERATING_PERIODS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const row = await apiFetch<OperatingPeriodsDTO>("/api/operating-periods");
      setData(row);
    } catch {
      setData(DEFAULT_OPERATING_PERIODS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ data, loading, refresh }), [data, loading, refresh]);

  return <OperatingPeriodsContext.Provider value={value}>{children}</OperatingPeriodsContext.Provider>;
}

export function useOperatingPeriods(): Ctx {
  const c = useContext(OperatingPeriodsContext);
  if (!c) throw new Error("useOperatingPeriods must be used within OperatingPeriodsProvider");
  return c;
}
