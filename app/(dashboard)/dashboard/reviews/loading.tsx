const tableRows = Array.from({ length: 6 })
const tableColumns = [
  { label: '고객사', width: '14%' },
  { label: '담당자', width: '9%' },
  { label: '기장 기간', width: '8%' },
  { label: '요청 방식', width: '8%' },
  { label: '자료 상태', width: '10%' },
  { label: '귀속기간', width: '10%' },
  { label: '계정항목', width: '10%' },
  { label: '전표분개', width: '10%' },
  { label: '자료/거래', width: '9%', align: 'right' },
]

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-7 w-24 rounded bg-gray-200" />
            <div className="h-6 w-32 rounded-full bg-blue-50" />
          </div>
          <div className="h-4 w-[36rem] max-w-full rounded bg-gray-100" />
        </div>
        <div className="h-9 w-36 rounded-md bg-blue-100" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="h-5 w-40 rounded bg-gray-200" />
              <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-100" />
            </div>
            <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              자료검토 화면을 준비하고 있습니다
            </div>
          </div>
          <div className="mt-4 h-9 w-full max-w-xl rounded-md bg-gray-100" />
        </div>

        <div className="overflow-x-auto p-4">
          <div className="min-w-[900px] overflow-hidden rounded-lg border border-border">
            <div className="flex border-b border-border bg-muted/40 text-xs text-muted-foreground">
              {tableColumns.map((column) => (
                <div key={column.label} className={column.align === 'right' ? 'px-3 py-3 text-right' : 'px-3 py-3'} style={{ width: column.width }}>
                  {column.label}
                </div>
              ))}
            </div>
            <div className="divide-y divide-border">
              {tableRows.map((_, index) => (
                <div key={index} className="flex items-center">
                  <div className="px-3 py-4" style={{ width: tableColumns[0].width }}><div className="h-4 rounded bg-gray-200" /></div>
                  <div className="px-3 py-4" style={{ width: tableColumns[1].width }}><div className="h-4 rounded bg-gray-100" /></div>
                  <div className="px-3 py-4" style={{ width: tableColumns[2].width }}><div className="h-4 rounded bg-gray-100" /></div>
                  <div className="px-3 py-4" style={{ width: tableColumns[3].width }}><div className="h-4 rounded bg-gray-100" /></div>
                  <div className="px-3 py-4" style={{ width: tableColumns[4].width }}><div className="h-6 w-20 rounded-full bg-blue-50" /></div>
                  <div className="px-3 py-4" style={{ width: tableColumns[5].width }}><div className="h-6 w-20 rounded-full bg-gray-100" /></div>
                  <div className="px-3 py-4" style={{ width: tableColumns[6].width }}><div className="h-6 w-20 rounded-full bg-gray-100" /></div>
                  <div className="px-3 py-4" style={{ width: tableColumns[7].width }}><div className="h-6 w-20 rounded-full bg-gray-100" /></div>
                  <div className="px-3 py-4" style={{ width: tableColumns[8].width }}><div className="ml-auto h-4 w-12 rounded bg-gray-100" /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
        업로드된 파일과 검토 결과를 불러오는 중입니다. 고객사나 파일 수가 많으면 잠시 시간이 걸릴 수 있습니다.
      </div>
    </div>
  )
}
