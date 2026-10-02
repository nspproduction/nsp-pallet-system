export default function LiffLayout({ children }: LayoutProps<"/liff">) {
  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-sm">
        {children}
      </div>
    </div>
  );
}
