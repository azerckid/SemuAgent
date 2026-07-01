import { useState, type ReactNode } from 'react'
import { ko } from 'date-fns/locale'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  MAIL_TEMPLATE_WORK_TYPE_LABEL,
  type SystemMailTemplate,
} from '@/lib/mail-console/default-templates'
import { cn } from '@/lib/utils'
import { DateTime, fromISO, now } from '@/lib/time'
import {
  consoleBadgeClass,
  consoleCardDescriptionClass,
  consoleCardTitleClass,
  consoleFieldLabelClass,
} from './mail-console-styles'
import { mailTemplateTokens, type MailConsoleTemplateDraft, type MailTemplateRow } from './mail-console-types'

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  month: index + 1,
  label: `${index + 1}월`,
}))

interface TemplateComposerProps {
  draft: MailConsoleTemplateDraft
  isDraftDirty: boolean
  templateNotice: string | null
  templates: MailTemplateRow[]
  onChange: (nextDraft: MailConsoleTemplateDraft, options?: { dirty?: boolean }) => void
  onWorkTypeChange: (workType: MailConsoleTemplateDraft['workType']) => void
  onApplyTemplate: (template: MailTemplateRow | SystemMailTemplate) => void
  onApplyWorkTypeDefault: () => void
  onSaveCurrentTemplate: () => void
}

export function TemplateComposer({
  draft,
  isDraftDirty,
  templateNotice,
  templates,
  onChange,
  onWorkTypeChange,
  onApplyTemplate,
  onApplyWorkTypeDefault,
  onSaveCurrentTemplate,
}: TemplateComposerProps) {
  const setField = <K extends keyof MailConsoleTemplateDraft>(field: K) => (
    value: MailConsoleTemplateDraft[K],
    options?: { dirty?: boolean },
  ) => {
    onChange({ ...draft, [field]: value }, options)
  }
  const templateOptions = getTemplateOptions(templates)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className={consoleCardTitleClass}>2. 발송 내용 작성</CardTitle>
          <CardDescription className={consoleCardDescriptionClass}>
            업무유형에 맞는 템플릿과 식별자로 이번 발송 메일을 작성합니다.
          </CardDescription>
        </div>
        <Badge variant="info" className={consoleBadgeClass}>식별자 {mailTemplateTokens.length}개</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="기본업무유형">
            <Select
              value={draft.workType}
              onChange={(event) => onWorkTypeChange(event.target.value as MailConsoleTemplateDraft['workType'])}
            >
              <option value="bookkeeping">{MAIL_TEMPLATE_WORK_TYPE_LABEL.bookkeeping}</option>
              <option value="payroll">{MAIL_TEMPLATE_WORK_TYPE_LABEL.payroll}</option>
              <option value="vat">{MAIL_TEMPLATE_WORK_TYPE_LABEL.vat}</option>
            </Select>
          </Field>
          <Field label="템플릿">
            <Select
              value={templateOptions.some((option) => option.id === draft.appliedTemplateId)
                ? draft.appliedTemplateId ?? ''
                : ''}
              onChange={(event) => {
                const selected = templateOptions.find((option) => option.id === event.target.value)
                if (selected) onApplyTemplate(selected.template)
              }}
              disabled={templateOptions.length === 0}
            >
              <option value="">
                {templateOptions.length === 0 ? '저장한 템플릿 없음' : '저장한 템플릿 선택'}
              </option>
              {templateOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="대상 기간" asLabel={false}>
            <MonthPicker
              value={draft.accountingPeriod}
              onChange={(value) => setField('accountingPeriod')(value, { dirty: false })}
            />
          </Field>
          <Field label="제출기한" asLabel={false}>
            <DueDatePicker
              value={draft.dueDate}
              onChange={(value) => setField('dueDate')(value, { dirty: false })}
            />
          </Field>
        </div>

        <Field label="제목">
          <Input value={draft.subject} onChange={(event) => setField('subject')(event.target.value)} />
        </Field>

        <Field label="본문">
          <Textarea
            rows={12}
            value={draft.body}
            onChange={(event) => setField('body')(event.target.value)}
            className="min-h-[260px] resize-y leading-6"
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>
            {templateNotice ?? (isDraftDirty
              ? '제목/본문 수정은 이번 발송에만 적용됩니다.'
              : '업무유형에 맞는 기본 템플릿이 적용되어 있습니다.')}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onApplyWorkTypeDefault}>
              기본 문구 적용
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onSaveCurrentTemplate}>
              템플릿으로 저장
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          {mailTemplateTokens.map((token) => (
            <Badge key={token} variant="outline" className={consoleBadgeClass}>{token}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function getTemplateOptions(templates: MailTemplateRow[]) {
  return templates
    .filter((template) => template.isActive)
    .map((template) => ({
      id: template.id,
      label: template.clientName ? `${template.name} · ${template.clientName}` : template.name,
      template,
    }))
}
function MonthPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const selectedMonth = parseAccountingMonth(value)
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => (
    selectedMonth.isValid ? selectedMonth.year : now().year
  ))
  const displayValue = selectedMonth.isValid
    ? selectedMonth.toFormat('yyyy년 M월')
    : value

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen && selectedMonth.isValid) {
      setViewYear(selectedMonth.year)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        type="button"
        aria-label="대상 기간 선택"
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-8 w-full justify-between rounded-lg border-input bg-background px-2.5 text-left font-normal'
        )}
      >
        <span>{displayValue}</span>
        <CalendarIcon className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="이전 연도"
            onClick={() => setViewYear((year) => year - 1)}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <div className="text-sm font-medium">{viewYear}년</div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="다음 연도"
            onClick={() => setViewYear((year) => year + 1)}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {MONTH_OPTIONS.map((option) => {
            const isSelected =
              selectedMonth.isValid
              && selectedMonth.year === viewYear
              && selectedMonth.month === option.month

            return (
              <Button
                key={option.month}
                type="button"
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                className="justify-center"
                onClick={() => {
                  const nextMonth = DateTime.fromObject(
                    { year: viewYear, month: option.month, day: 1 },
                    { zone: 'Asia/Seoul' }
                  ).toFormat('yyyy-MM')
                  onChange(nextMonth)
                  setOpen(false)
                }}
              >
                {option.label}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function DueDatePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedDate = toCalendarDate(value)
  const parsed = fromISO(value)
  const displayValue = parsed.isValid ? parsed.toFormat('yyyy-MM-dd') : value

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label="제출기한 선택"
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-8 w-full justify-between rounded-lg border-input bg-background px-2.5 text-left font-normal'
        )}
      >
        <span>{displayValue}</span>
        <CalendarIcon className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          locale={ko}
          onSelect={(date) => {
            if (!date) return
            const nextDate = DateTime.fromObject(
              {
                year: date.getFullYear(),
                month: date.getMonth() + 1,
                day: date.getDate(),
              },
              { zone: 'Asia/Seoul' }
            ).toISODate()
            if (nextDate) {
              onChange(nextDate)
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function parseAccountingMonth(value: string): DateTime {
  return DateTime.fromFormat(value, 'yyyy-MM', { zone: 'Asia/Seoul' })
}

function toCalendarDate(value: string): Date | undefined {
  const parsed = fromISO(value)
  if (!parsed.isValid) return undefined
  return parsed.startOf('day').toJSDate()
}

function Field({
  label,
  children,
  asLabel = true,
}: {
  label: string
  children: ReactNode
  asLabel?: boolean
}) {
  if (!asLabel) {
    return (
      <div className="grid gap-1.5">
        <span className={consoleFieldLabelClass}>{label}</span>
        {children}
      </div>
    )
  }

  return (
    <label className="grid gap-1.5">
      <span className={consoleFieldLabelClass}>{label}</span>
      {children}
    </label>
  )
}
