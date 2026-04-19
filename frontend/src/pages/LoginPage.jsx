import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import Card from "../components/Card.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import Button from "../components/ui/Button.jsx";
import InputField from "../components/ui/InputField.jsx";
import { useAuth } from "../state/AuthContext.jsx";

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
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

    if (!formData.email.trim()) {
      nextErrors.email = "Enter your email address.";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      nextErrors.email = "Use a valid email address.";
    }

    if (!formData.password.trim()) {
      nextErrors.password = "Enter your password.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await login(formData);
      navigate("/dashboard");
    } catch (apiError) {
      setError(apiError.response?.data?.detail ?? "Login failed. Check your details.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="auth-screen">
      <div className="auth-spotlight">
        <img
          src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80"
          alt="Student using a laptop with notes on a desk"
        />
        <div className="auth-spotlight-copy">
          <p className="eyebrow">Welcome back</p>
          <h1>Return to a dashboard built for steady learning momentum.</h1>
          <p>
            Review recommendations, recent activity, and the next action worth taking
            without losing context.
          </p>
        </div>
      </div>

      <div className="auth-page">
        <Card subtitle="Use your StudyGenie account to continue." title="Log in">
          <form className="input-form" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              error={fieldErrors.password}
              label="Password"
              name="password"
              placeholder="Your password"
              type="password"
              value={formData.password}
              onChange={handleChange}
            />

            <Button loading={isLoading} type="submit">
              {isLoading ? "Signing in" : "Log in"}
            </Button>
          </form>
          {isLoading && <LoadingSpinner />}
          {error && <p className="error-message">{error}</p>}
          <p className="auth-switch">
            New here? <Link to="/register">Create an account</Link>
          </p>
          <p className="auth-switch">
            <Link to="/">Back to landing page</Link>
          </p>
        </Card>
      </div>
    </section>
  );
}

export default LoginPage;
