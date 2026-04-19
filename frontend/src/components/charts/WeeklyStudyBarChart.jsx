import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function buildWeekData(sessions) {
  const totals = new Map();
  const today = new Date();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    totals.set(key, 0);
  }

  sessions.forEach((session) => {
    if (totals.has(session.date)) {
      totals.set(session.date, totals.get(session.date) + Number(session.time_spent));
    }
  });

  return [...totals.entries()].map(([date, minutes]) => ({
    date,
    label: new Date(date).toLocaleDateString(undefined, { weekday: "short" }),
    minutes,
  }));
}

function WeeklyStudyBarChart({ sessions }) {
  const data = buildWeekData(sessions);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 14, left: -10, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 12 }} />
        <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            background: "#111827",
            border: "1px solid #1F2937",
            borderRadius: 12,
            color: "#E5E7EB",
          }}
        />
        <Bar dataKey="minutes" fill="#6366F1" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default WeeklyStudyBarChart;
