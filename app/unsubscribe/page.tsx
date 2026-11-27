import UnsubscribeForm from "./unsubscribe-form";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-primary">
          הסרה מרשימת התפוצה
        </h1>
        {token ? (
          <UnsubscribeForm token={token} />
        ) : (
          <p className="text-button">קישור לא תקין - חסר טוקן.</p>
        )}
      </div>
    </div>
  );
}
