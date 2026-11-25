import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/Feedback";

export default function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      message="That page doesn’t exist in your closet."
      action={<Link to="/" className="btn-primary">Back to Today</Link>}
    />
  );
}
