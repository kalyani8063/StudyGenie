import { useState } from "react";

import Button from "./ui/Button.jsx";
import InputField from "./ui/InputField.jsx";

const initialValues = {
  topic: "",
  score: "",
  attempts: "",
  time_spent: "",
};

function InputForm({ onSubmit, isLoading }) {
  const [formData, setFormData] = useState(initialValues);
  const [errors, setErrors] = useState({});

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};

    if (!formData.topic.trim()) nextErrors.topic = "Add the topic you are reviewing.";
    if (!formData.score || Number(formData.score) < 0 || Number(formData.score) > 100) {
      nextErrors.score = "Use a score between 0 and 100.";
    }
    if (!formData.attempts || Number(formData.attempts) < 1) {
      nextErrors.attempts = "Enter at least one attempt.";
    }
    if (!formData.time_spent || Number(formData.time_spent) < 1) {
      nextErrors.time_spent = "Log the study time in minutes.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({
      topic: formData.topic.trim(),
      score: Number(formData.score),
      attempts: Number(formData.attempts),
      time_spent: Number(formData.time_spent),
    });
  }

  return (
    <form className="input-form" onSubmit={handleSubmit}>
      <InputField
        error={errors.topic}
        label="Topic"
        name="topic"
        placeholder="Algebra"
        type="text"
        value={formData.topic}
        onChange={handleChange}
      />

      <div className="form-grid">
        <InputField
          error={errors.score}
          label="Score"
          max="100"
          min="0"
          name="score"
          placeholder="72"
          type="number"
          value={formData.score}
          onChange={handleChange}
        />

        <InputField
          error={errors.attempts}
          label="Attempts"
          max="5"
          min="1"
          name="attempts"
          placeholder="2"
          type="number"
          value={formData.attempts}
          onChange={handleChange}
        />
      </div>

      <InputField
        error={errors.time_spent}
        label="Time spent"
        max="120"
        min="10"
        name="time_spent"
        placeholder="45"
        type="number"
        value={formData.time_spent}
        onChange={handleChange}
      />

      <Button loading={isLoading} type="submit">
        {isLoading ? "Checking..." : "Get Recommendation"}
      </Button>
    </form>
  );
}

export default InputForm;
