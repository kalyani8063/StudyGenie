import { useEffect, useState } from "react";

import Card from "../components/Card.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import StatCard from "../components/StatCard.jsx";
import Button from "../components/ui/Button.jsx";
import InputField from "../components/ui/InputField.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { useStudy } from "../state/StudyContext.jsx";

function ProfilePage() {
  const { refreshProfile, saveProfile, user } = useAuth();
  const { history, studySessions } = useStudy();
  const [formData, setFormData] = useState({
    full_name: "",
    age: "",
    education_level: "",
    study_goal: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const totalStudyTime = studySessions.reduce(
    (total, item) => total + Number(item.time_spent),
    0,
  );

  useEffect(() => {
    refreshProfile().catch(() => {
      setError("Could not load your profile. Please login again.");
    });
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name ?? "",
        age: user.age ?? "",
        education_level: user.education_level ?? "",
        study_goal: user.study_goal ?? "",
      });
    }
  }, [user]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      await saveProfile({
        ...formData,
        age: formData.age ? Number(formData.age) : null,
      });
      setMessage("Profile updated.");
    } catch {
      setError("Could not update profile.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="profile-page">
      <div className="page-heading">
        <p className="eyebrow">Profile</p>
        <h2>Personal details and learning summary.</h2>
      </div>

      <div className="stat-grid compact">
        <StatCard label="Saved Results" value={history.length} helper="Recommendation history" />
        <StatCard label="Study Time" value={`${totalStudyTime} min`} helper="Logged sessions" />
      </div>

      <Card subtitle="Keep your profile current across the workspace." title="Personal details">
        <form className="input-form" onSubmit={handleSubmit}>
          <InputField
            label="Full name"
            name="full_name"
            type="text"
            value={formData.full_name}
            onChange={handleChange}
          />

          <div className="form-grid">
            <InputField label="Email" type="email" value={user?.email ?? ""} disabled />

            <InputField
              label="Age"
              max="100"
              min="5"
              name="age"
              type="number"
              value={formData.age}
              onChange={handleChange}
            />
          </div>

          <InputField
            label="Education level"
            name="education_level"
            type="text"
            value={formData.education_level}
            onChange={handleChange}
          />

          <InputField
            label="Study goal"
            name="study_goal"
            type="text"
            value={formData.study_goal}
            onChange={handleChange}
          />

          <Button loading={isLoading} type="submit">
            Save profile
          </Button>
        </form>
        {isLoading && <LoadingSpinner />}
        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}
      </Card>
    </section>
  );
}

export default ProfilePage;
