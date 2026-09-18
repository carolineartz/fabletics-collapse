"""Compose store images from a transparent logo PNG. Pure Python + macOS sips."""
import struct, subprocess, sys, tempfile, zlib
from pathlib import Path

def read_png(path):
    data = Path(path).read_bytes(); assert data[:8] == b'\x89PNG\r\n\x1a\n', 'not a PNG'
    pos, idat, w, h, ct = 8, b'', None, None, None
    while pos < len(data):
        ln, = struct.unpack('>I', data[pos:pos+4]); typ = data[pos+4:pos+8]; body = data[pos+8:pos+8+ln]; pos += 12 + ln
        if typ == b'IHDR': w, h, bd, ct = struct.unpack('>IIBB', body[:10]); assert bd == 8, 'need 8-bit PNG'
        elif typ == b'IDAT': idat += body
    ch = {6: 4, 2: 3}[ct]; raw = zlib.decompress(idat); stride = w * ch
    rows, prev, p = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[p]; p += 1; line = bytearray(raw[p:p+stride]); p += stride
        for i in range(stride):
            a = line[i-ch] if i >= ch else 0; b = prev[i]; c = prev[i-ch] if i >= ch else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                pa, pb, pc = abs(b-c), abs(a-c), abs(a+b-2*c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        if ch == 3: line = bytearray(b''.join(bytes(line[i:i+3]) + b'\xff' for i in range(0, stride, 3)))
        rows.append(bytes(line)); prev = line
    return w, h, rows

def write_png(path, w, h, rows):
    raw = b''.join(b'\x00' + r for r in rows)
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    Path(path).write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def bbox(w, h, rows):
    xs = [x for y in range(h) for x in range(w) if rows[y][x*4+3] > 8]
    ys = [y for y in range(h) if any(rows[y][x*4+3] > 8 for x in range(w))]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1

def crop(w, h, rows, x0, y0, x1, y1):
    return x1 - x0, y1 - y0, [rows[y][x0*4:x1*4] for y in range(y0, y1)]

def scale_to_fit(path, box_w, box_h):
    """Resize with sips so the image fits inside box_w x box_h; returns (w, h, rows)."""
    out = Path(tempfile.mkdtemp()) / 'scaled.png'
    subprocess.run(['sips', '-Z', str(max(box_w, box_h)), str(path), '--out', str(out)], check=True, capture_output=True)
    w, h, rows = read_png(out)
    if w > box_w or h > box_h:
        subprocess.run(['sips', '-z', str(box_h if h/box_h >= w/box_w else round(h * box_w / w)),
                        str(box_w if w/box_w >= h/box_h else round(w * box_h / h)), str(out), '--out', str(out)],
                       check=True, capture_output=True)
        w, h, rows = read_png(out)
    return w, h, rows

def compose(canvas_w, canvas_h, bg, logo, out_path):
    lw, lh, lrows = logo
    ox, oy = (canvas_w - lw) // 2, (canvas_h - lh) // 2
    rows = []
    for y in range(canvas_h):
        line = bytearray(bg * canvas_w)
        if oy <= y < oy + lh:
            src = lrows[y - oy]
            for x in range(lw):
                r, g, b, a = src[x*4:x*4+4]
                if a == 0: continue
                dst = (ox + x) * 4
                if bg[3] == 0:
                    line[dst:dst+4] = bytes((r, g, b, a))
                else:
                    line[dst]   = (r * a + line[dst]   * (255 - a)) // 255
                    line[dst+1] = (g * a + line[dst+1] * (255 - a)) // 255
                    line[dst+2] = (b * a + line[dst+2] * (255 - a)) // 255
                    line[dst+3] = 255
        rows.append(bytes(line))
    write_png(out_path, canvas_w, canvas_h, rows)
    print('Wrote', out_path)

def main(src, out_dir):
    out_dir = Path(out_dir)
    w, h, rows = read_png(src)
    x0, y0, x1, y1 = bbox(w, h, rows)
    tight = Path(tempfile.mkdtemp()) / 'tight.png'
    write_png(tight, *crop(w, h, rows, x0, y0, x1, y1))
    transparent, white = (0, 0, 0, 0), (255, 255, 255, 255)
    compose(128, 128, transparent, scale_to_fit(tight, 96, 96), out_dir / 'icon-128.png')
    compose(440, 280, white, scale_to_fit(tight, 300, 180), out_dir / 'promo-440x280.png')
    compose(1400, 560, white, scale_to_fit(tight, 900, 360), out_dir / 'promo-1400x560.png')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
