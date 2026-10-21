import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container page empty-state">
      <h1>Page not found</h1>
      <p className="muted">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary">Go to shop</Link>
    </div>
  );
}
