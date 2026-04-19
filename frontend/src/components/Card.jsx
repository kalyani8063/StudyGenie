function Card({ children, className = "", title, subtitle, action }) {
  return (
    <section className={`card ${className}`}>
      {(title || subtitle || action) && (
        <div className="card-title-row">
          <div className="card-heading-block">
            {title && <h2>{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export default Card;
