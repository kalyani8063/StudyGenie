import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function MetricBarChart({ metrics }) {
  const data = metrics
    ? [
        { name: "Score", value: Number(metrics.score) },
        { name: "Attempts", value: Number(metrics.attempts) },
        { name: "Time", value: Number(metrics.time_spent) },
      ]
    : [];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 14, left: -10, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} />
        <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            background: "#111827",
            border: "1px solid #1F2937",
            borderRadius: 12,
            color: "#E5E7EB",
          }}
        />
        <Bar dataKey="value" fill="#6366F1" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default MetricBarChart;
