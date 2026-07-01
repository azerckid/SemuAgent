export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-48 bg-gray-200 rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  )
}
