import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import Card from "../components/Card.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import Button from "../components/ui/Button.jsx";
import InputField from "../components/ui/InputField.jsx";
import { useAuth } from "../state/AuthContext.jsx";

const initialForm = {
  full_name: "",
  email: "",
  password: "",
  age: "",
  education_level: "",
  study_goal: "",
};

function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, register } = useAuth();
  const [formData, setFormData] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate replace to="/dashboard" />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};

    if (!formData.full_name.trim()) nextErrors.full_name = "Tell us your name.";
    if (!formData.email.trim()) {
      nextErrors.email = "Enter your email address.";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      nextErrors.email = "Use a valid email address.";
    }
    if (!formData.password.trim()) {
      nextErrors.password = "Create a password.";
    } else if (formData.password.length < 6) {
      nextErrors.password = "Use at least 6 characters.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await register({
        ...formData,
        age: formData.age ? Number(formData.age) : null,
      });
      navigate("/dashboard");
    } catch (apiError) {
      setError(apiError.response?.data?.detail ?? "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="auth-screen">
      <div className="auth-spotlight">
        <img
          src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80"
          alt="Student reading in a bright library"
        />
        <div className="auth-spotlight-copy">
          <p className="eyebrow">Get started</p>
          <h1>Create your account and launch straight into your study workspace.</h1>
          <p>
            Set up once and keep recommendations, tracking, and personalized plans in a
            polished dashboard built for repeat use.
          </p>
        </div>
      </div>

      <div className="auth-page">
        <Card subtitle="Create your StudyGenie workspace." title="Create account">
          <form className="input-form" onSubmit={handleSubmit}>
            <InputField
              error={fieldErrors.full_name}
              label="Full name"
              name="full_name"
              placeholder="Aarav Sharma"
              type="text"
              value={formData.full_name}
              onChange={handleChange}
            />

            <div className="form-grid">
              <InputField
                autoComplete="email"
                error={fieldErrors.email}
                label="Email"
                name="email"
                placeholder="student@example.com"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />

              <InputField
                autoComplete="new-password"
                error={fieldErrors.password}
                label="Password"
                minLength="6"
                name="password"
                placeholder="At least 6 characters"
                type="password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <div className="form-grid">
              <InputField
                label="Age"
                max="100"
                min="5"
                name="age"
                placeholder="20"
                type="number"
                value={formData.age}
                onChange={handleChange}
              />

              <InputField
                label="Education level"
                name="education_level"
                placeholder="College"
                type="text"
                value={formData.education_level}
                onChange={handleChange}
              />
            </div>

            <InputField
              label="Study goal"
              name="study_goal"
              placeholder="Improve exam scores"
              type="text"
              value={formData.study_goal}
              onChange={handleChange}
            />

            <Button loading={isLoading} type="submit">
              {isLoading ? "Creating account" : "Create account"}
            </Button>
          </form>
          {isLoading && <LoadingSpinner />}
          {error && <p className="error-message">{error}</p>}
          <p className="auth-switch">
            Already registered? <Link to="/login">Login</Link>
          </p>
          <p className="auth-switch">
            <Link to="/">Back to landing page</Link>
          </p>
        </Card>
      </div>
    </section>
  );
}

export default RegisterPage;
