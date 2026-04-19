import SessionTimerCard from "../components/SessionTimerCard.jsx";

function FocusTimerPage() {
  return (
    <section className="timer-page">
      <div className="page-heading">
        <p className="eyebrow">Focus Timer</p>
        <h2>Run a focused study block, log breaks, and keep both tied to your weekly plan.</h2>
      </div>

      <SessionTimerCard
        subtitle="Use focus mode for study blocks and break mode for recovery periods between them."
        title="Focus and break timer"
      />
    </section>
  );
}

export default FocusTimerPage;
