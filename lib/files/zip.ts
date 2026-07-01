type ZipEntry = {
  filename: string
  data: Uint8Array
}

const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < CRC_TABLE.length; i += 1) {
  let c = i
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  }
  CRC_TABLE[i] = c >>> 0
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function sanitizeEntryName(filename: string) {
  return filename
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '_')
    .trim() || 'file'
}

function makeUniqueEntryNames(entries: ZipEntry[]) {
  const seen = new Map<string, number>()
  return entries.map((entry) => {
    const sanitized = sanitizeEntryName(entry.filename)
    const count = seen.get(sanitized) ?? 0
    seen.set(sanitized, count + 1)

    if (count === 0) return sanitized

    const dot = sanitized.lastIndexOf('.')
    if (dot > 0) {
      return `${sanitized.slice(0, dot)} (${count + 1})${sanitized.slice(dot)}`
    }
    return `${sanitized} (${count + 1})`
  })
}

function writeLocalHeader(filenameBytes: Uint8Array, data: Uint8Array, crc: number) {
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0x0800, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt16LE(0, 12)
  header.writeUInt32LE(crc, 14)
  header.writeUInt32LE(data.length, 18)
  header.writeUInt32LE(data.length, 22)
  header.writeUInt16LE(filenameBytes.length, 26)
  header.writeUInt16LE(0, 28)
  return Buffer.concat([header, Buffer.from(filenameBytes)])
}

function writeCentralHeader(filenameBytes: Uint8Array, data: Uint8Array, crc: number, offset: number) {
  const header = Buffer.alloc(46)
  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(20, 6)
  header.writeUInt16LE(0x0800, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt16LE(0, 12)
  header.writeUInt16LE(0, 14)
  header.writeUInt32LE(crc, 16)
  header.writeUInt32LE(data.length, 20)
  header.writeUInt32LE(data.length, 24)
  header.writeUInt16LE(filenameBytes.length, 28)
  header.writeUInt16LE(0, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(0, 38)
  header.writeUInt32LE(offset, 42)
  return Buffer.concat([header, Buffer.from(filenameBytes)])
}

function writeEndRecord(entryCount: number, centralSize: number, centralOffset: number) {
  const record = Buffer.alloc(22)
  record.writeUInt32LE(0x06054b50, 0)
  record.writeUInt16LE(0, 4)
  record.writeUInt16LE(0, 6)
  record.writeUInt16LE(entryCount, 8)
  record.writeUInt16LE(entryCount, 10)
  record.writeUInt32LE(centralSize, 12)
  record.writeUInt32LE(centralOffset, 16)
  record.writeUInt16LE(0, 20)
  return record
}

export function createZipArchive(entries: ZipEntry[]) {
  const encoder = new TextEncoder()
  const names = makeUniqueEntryNames(entries)
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  entries.forEach((entry, index) => {
    const data = Buffer.from(entry.data)
    const filenameBytes = encoder.encode(names[index])
    const crc = crc32(data)
    const localHeader = writeLocalHeader(filenameBytes, data, crc)

    localParts.push(localHeader, data)
    centralParts.push(writeCentralHeader(filenameBytes, data, crc, offset))
    offset += localHeader.length + data.length
  })

  const local = Buffer.concat(localParts)
  const central = Buffer.concat(centralParts)
  const end = writeEndRecord(entries.length, central.length, local.length)

  return Buffer.concat([local, central, end])
}
