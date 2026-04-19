import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ProgressLineChart({ history }) {
  const fallback = [
    { name: "Day 1", score: 38 },
    { name: "Day 2", score: 46 },
    { name: "Day 3", score: 58 },
    { name: "Day 4", score: 67 },
    { name: "Day 5", score: 76 },
  ];

  const data =
    history.length > 0
      ? [...history]
          .reverse()
          .slice(-8)
          .map((entry, index) => ({
            name: `Try ${index + 1}`,
            score: Number(entry.metrics.score),
          }))
      : fallback;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 16, right: 18, left: -10, bottom: 8 }}>
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
        <Line
          type="monotone"
          dataKey="score"
          stroke="#6366F1"
          strokeWidth={3}
          dot={{ r: 4, fill: "#6366F1", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default ProgressLineChart;
