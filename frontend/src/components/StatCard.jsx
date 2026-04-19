function StatCard({ label, value, helper, tone = "neutral" }) {
  return (
    <section className={`stat-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {helper && <span>{helper}</span>}
    </section>
  );
}

export default StatCard;
