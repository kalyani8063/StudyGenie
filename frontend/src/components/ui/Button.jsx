function Button({
  children,
  className = "",
  loading = false,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}) {
  return (
    <button
      className={`button button-${variant} button-${size} ${className}`.trim()}
      type={type}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <span className="button-spinner" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

export default Button;
