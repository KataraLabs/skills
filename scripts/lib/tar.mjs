// A reproducible ustar writer: fixed mtime, owner and mode, entries in the order given.
// The same inputs always produce the same bytes, so a release checksum can be rebuilt
// and compared by anyone. Only regular files are written; directories are implied.

const BLOCK = 512;

function splitPath(path) {
  const bytes = Buffer.byteLength(path);
  if (bytes <= 100) return { name: path, prefix: '' };
  // ustar keeps up to 155 bytes of leading directories in a separate prefix field.
  for (let i = path.lastIndexOf('/'); i > 0; i = path.lastIndexOf('/', i - 1)) {
    const prefix = path.slice(0, i);
    const name = path.slice(i + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { name, prefix };
  }
  throw new Error(`path too long for ustar: ${path}`);
}

function octal(n, width) {
  return n.toString(8).padStart(width - 1, '0') + '\0';
}

export function header(path, size, { mode = 0o644, mtime = 0 } = {}) {
  const { name, prefix } = splitPath(path);
  const h = Buffer.alloc(BLOCK, 0);
  h.write(name, 0, 100, 'utf8');
  h.write(octal(mode, 8), 100, 8, 'ascii');
  h.write(octal(0, 8), 108, 8, 'ascii');
  h.write(octal(0, 8), 116, 8, 'ascii');
  h.write(octal(size, 12), 124, 12, 'ascii');
  h.write(octal(mtime, 12), 136, 12, 'ascii');
  h.fill(0x20, 148, 156);
  h.write('0', 156, 1, 'ascii');
  h.write('ustar\0', 257, 6, 'ascii');
  h.write('00', 263, 2, 'ascii');
  h.write(prefix, 345, 155, 'utf8');
  let sum = 0;
  for (const b of h) sum += b;
  h.write(octal(sum, 7) + ' ', 148, 8, 'ascii');
  return h;
}

// entries: [{ path, data: Buffer, mode? }]
export function tar(entries) {
  const parts = [];
  for (const e of entries) {
    parts.push(header(e.path, e.data.length, { mode: e.mode }));
    parts.push(e.data);
    const pad = (BLOCK - (e.data.length % BLOCK)) % BLOCK;
    if (pad) parts.push(Buffer.alloc(pad, 0));
  }
  parts.push(Buffer.alloc(BLOCK * 2, 0));
  return Buffer.concat(parts);
}
