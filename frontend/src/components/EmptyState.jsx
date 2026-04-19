function EmptyState({ title, message, action }) {
  return (
    <div className="empty-state">
      <strong className="empty-state-title">{title}</strong>
      <p>{message}</p>
      {action}
    </div>
  );
}

export default EmptyState;
