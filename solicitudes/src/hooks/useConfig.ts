"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { DEFAULT_CALENDAR, DEFAULT_SLA } from "@/lib/business/constants";
import type { BusinessCalendar, SlaSettings } from "@/lib/types";

export function useConfig() {
  const [sla, setSla] = useState<SlaSettings>(DEFAULT_SLA);
  const [calendar, setCalendar] = useState<BusinessCalendar>(DEFAULT_CALENDAR);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u1 = onSnapshot(doc(db, "slaSettings", "config"), (s) => {
      if (s.exists()) setSla(s.data() as SlaSettings);
      setLoading(false);
    });
    const u2 = onSnapshot(doc(db, "businessCalendar", "config"), (s) => {
      if (s.exists()) setCalendar(s.data() as BusinessCalendar);
    });
    return () => {
      u1();
      u2();
    };
  }, []);

  return { sla, calendar, loading };
}
