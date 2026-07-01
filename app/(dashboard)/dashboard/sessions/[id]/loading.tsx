export default function Loading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-5 w-72 bg-gray-200 rounded" />
      <div className="h-36 bg-gray-100 rounded-xl" />
      <div className="h-28 bg-gray-100 rounded-xl" />
      <div className="h-32 bg-orange-50 rounded-xl border border-orange-100" />
      <div className="h-64 bg-gray-100 rounded-xl" />
      <div className="space-y-4">
        <div className="h-20 bg-gray-100 rounded-xl" />
        <div className="h-44 bg-gray-100 rounded-xl" />
        <div className="h-44 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}
