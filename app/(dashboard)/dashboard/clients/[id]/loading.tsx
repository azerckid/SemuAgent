export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-64 bg-gray-200 rounded" />
      <div className="h-48 bg-gray-100 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}
