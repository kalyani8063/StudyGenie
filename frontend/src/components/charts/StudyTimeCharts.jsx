import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const colors = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

function groupByTopic(sessions) {
  const totals = sessions.reduce((acc, session) => {
    acc[session.topic] = (acc[session.topic] ?? 0) + Number(session.time_spent);
    return acc;
  }, {});

  return Object.entries(totals).map(([name, value]) => ({ name, value }));
}

function groupByDate(sessions) {
  const totals = sessions.reduce((acc, session) => {
    acc[session.date] = (acc[session.date] ?? 0) + Number(session.time_spent);
    return acc;
  }, {});

  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }));
}

function StudyTimeCharts({ sessions }) {
  const topicData = groupByTopic(sessions);
  const dailyData = groupByDate(sessions);

  return (
    <div className="tracker-charts">
      <div>
        <h3>Time Per Topic</h3>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={topicData} dataKey="value" nameKey="name" outerRadius={86} label>
              {topicData.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #1F2937",
                borderRadius: 12,
                color: "#E5E7EB",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3>Daily Study Time</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dailyData} margin={{ top: 16, right: 14, left: -10, bottom: 8 }}>
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
            <Bar dataKey="value" fill="#10B981" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default StudyTimeCharts;
