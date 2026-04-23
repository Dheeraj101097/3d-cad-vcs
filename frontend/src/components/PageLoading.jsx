export default function PageLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] gap-4">
      <div className="spinner" />
      <span className="text-sm text-gray-500">Loading...</span>
    </div>
  );
}
