export default function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
        {error}
      </p>
    );
  if (ok) return <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{ok}</p>;
  return null;
}
