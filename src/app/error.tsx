"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Something interrupted the workspace.</h1>
      <p>
        Accepted answers are saved on the server. You can safely reload the
        session.
      </p>
      <button className="btn primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
