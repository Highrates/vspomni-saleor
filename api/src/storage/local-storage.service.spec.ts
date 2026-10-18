import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { detectImageMime, detectVideoMime, LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  const svc = new LocalStorageService({
    get: (key: string) => {
      if (key === 'LOCAL_UPLOADS_PUBLIC_URL') return 'http://127.0.0.1:3001';
      if (key === 'PORT') return 3001;
      return undefined;
    },
  } as never);

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);

  it('detectImageMime распознаёт JPEG/PNG', () => {
    expect(detectImageMime(jpeg)).toBe('image/jpeg');
    expect(detectImageMime(png)).toBe('image/png');
    expect(detectImageMime(Buffer.from([0x00, 0x01]))).toBeNull();
  });

  it('assertImage отклоняет не-картинку по magic bytes', () => {
    expect(() =>
      svc.assertImage({
        size: 12,
        mimetype: 'image/jpeg',
        buffer: Buffer.from('%PDF-1.4xxxxx'),
      }),
    ).toThrow(BadRequestException);
  });

  it('assertImage принимает JPEG по содержимому даже при чужом client MIME', () => {
    expect(svc.assertImage({ size: jpeg.length, mimetype: 'application/octet-stream', buffer: jpeg })).toBe(
      'image/jpeg',
    );
  });

  it('assertImage отклоняет >6MB', () => {
    expect(() =>
      svc.assertImage({ size: 7 * 1024 * 1024, mimetype: 'image/jpeg', buffer: jpeg }),
    ).toThrow(BadRequestException);
  });

  it('detectVideoMime распознаёт ftyp', () => {
    const buf = Buffer.alloc(16);
    buf.writeUInt32BE(0x18, 0);
    buf.write('ftyp', 4, 'ascii');
    buf.write('isom', 8, 'ascii');
    expect(detectVideoMime(buf, 'clip.mp4')).toBe('video/mp4');
    buf.write('qt  ', 8, 'ascii');
    expect(detectVideoMime(buf, 'clip.mov')).toBe('video/quicktime');
  });

  it('getPublicUrlForKey и tryPublicUrlToKey', () => {
    const url = svc.getPublicUrlForKey('products/a/b.jpg');
    expect(url).toBe('http://127.0.0.1:3001/uploads/products/a/b.jpg');
    expect(svc.tryPublicUrlToKey(url)).toBe('products/a/b.jpg');
    expect(svc.tryPublicUrlToKey('https://other/x')).toBeNull();
  });
});
