export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-32 bg-gray-200 rounded" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
