import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Users, ShieldAlert } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface SeriesPoint {
  label: string;
  count: number;
}

interface AdminVisitsResponse {
  stats: {
    allTime: number;
    last24Hours: number;
    lastMonth: number;
    lastYear: number;
  };
  series: {
    last24Hours: SeriesPoint[];
    lastMonth: SeriesPoint[];
    lastYear: SeriesPoint[];
    allTime: SeriesPoint[];
  };
  visits: {
    id: number;
    email: string | null;
    visitedAt: string;
  }[];
}

async function fetchAdminVisits(): Promise<AdminVisitsResponse> {
  const res = await fetch("/api/admin/visits", { credentials: "include" });
  if (!res.ok) {
    throw new Error(res.status === 403 ? "not_authorized" : "failed");
  }
  return res.json();
}

function StatCard({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold" data-testid={testId}>{value}</p>
      </CardContent>
    </Card>
  );
}

function LoginChart({ title, data }: { title: string; data: SeriesPoint[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(221, 83%, 53%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Administrative() {
  const { data, isLoading, error } = useQuery<AdminVisitsResponse>({
    queryKey: ["/api/admin/visits"],
    queryFn: fetchAdminVisits,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    const notAuthorized = (error as Error)?.message === "not_authorized";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold" data-testid="text-admin-error">
          {notAuthorized ? "Not authorized" : "Failed to load visitor data"}
        </h1>
        <p className="text-sm text-muted-foreground text-center">
          {notAuthorized
            ? "This page is only available to the site administrator."
            : "Something went wrong loading the analytics."}
        </p>
        <Button asChild variant="outline" data-testid="button-back-home">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to app
          </Link>
        </Button>
      </div>
    );
  }

  // Last week = sum of the most recent 7 daily buckets from the month series
  const weekSeries = data.series.lastMonth.slice(-7);
  const lastWeekCount = weekSeries.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Administrative</h1>
              <p className="text-xs text-muted-foreground">Google login analytics</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" data-testid="button-back">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to app
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Login counts</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Last 24 hours" value={data.stats.last24Hours} testId="stat-day" />
            <StatCard label="Last week" value={lastWeekCount} testId="stat-week" />
            <StatCard label="Last month" value={data.stats.lastMonth} testId="stat-month" />
            <StatCard label="Last year" value={data.stats.lastYear} testId="stat-year" />
            <StatCard label="All time" value={data.stats.allTime} testId="stat-alltime" />
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <LoginChart title="Last 24 hours (hourly)" data={data.series.last24Hours} />
          <LoginChart title="Last week (daily)" data={weekSeries} />
          <LoginChart title="Last month (daily)" data={data.series.lastMonth} />
          <LoginChart title="Last year (monthly)" data={data.series.lastYear} />
          <LoginChart title="All time" data={data.series.allTime} />
        </section>

        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Recent logins ({data.visits.length})
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Logged in at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.visits.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                          No logins recorded yet
                        </td>
                      </tr>
                    ) : (
                      data.visits.map((v) => (
                        <tr key={v.id} className="border-b last:border-0" data-testid={`row-visit-${v.id}`}>
                          <td className="px-4 py-2.5" data-testid={`text-visit-email-${v.id}`}>
                            {v.email || "(no email)"}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {new Date(v.visitedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
