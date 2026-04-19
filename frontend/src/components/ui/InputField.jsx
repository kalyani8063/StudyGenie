function InputField({
  className = "",
  error = "",
  helper = "",
  label,
  multiline = false,
  ...props
}) {
  const Element = multiline ? "textarea" : "input";

  return (
    <label className={`field ${error ? "field-has-error" : ""} ${className}`.trim()}>
      <span className="field-label">{label}</span>
      <Element className="field-input" {...props} />
      {error ? <span className="field-error">{error}</span> : helper ? <span className="field-helper">{helper}</span> : null}
    </label>
  );
}

export default InputField;
