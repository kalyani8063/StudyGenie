import Skeleton from "./ui/Skeleton.jsx";

function LoadingSpinner() {
  return (
    <div className="skeleton-stack" role="status" aria-live="polite">
      <Skeleton className="skeleton-line skeleton-line-lg" />
      <Skeleton className="skeleton-line" />
      <Skeleton className="skeleton-line skeleton-line-sm" />
    </div>
  );
}

export default LoadingSpinner;
