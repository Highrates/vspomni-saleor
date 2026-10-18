'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import type ReactQuillType from 'react-quill';
import type { ReactQuillProps } from 'react-quill';
import {
  AdminBackendRequestError,
  adminBackendFetch,
  readAdminApiError,
} from '@/lib/adminBackendFetch';
import styles from './AdminRichField.module.css';
import 'react-quill/dist/quill.snow.css';

type QuillProps = ReactQuillProps & {
  forwardedRef?: React.Ref<ReactQuillType>;
};

/** next/dynamic не пробрасывает ref — передаём через forwardedRef. */
const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import('react-quill');
    function Quill({ forwardedRef, ...props }: QuillProps) {
      return <RQ ref={forwardedRef} {...props} />;
    }
    Quill.displayName = 'ReactQuillDynamic';
    return Quill;
  },
  { ssr: false },
);

export type AdminRichFieldProps = {
  label: string;
  value: string;
  onChange: (html: string) => void;
  /** Nest path for image upload (default catalog rich media) */
  uploadPath?: string;
  /** Taller editor (blog body) */
  tall?: boolean;
  /** Компактный редактор (короткие поля вроде «Хранение») */
  compact?: boolean;
  /** После успешной загрузки картинки в редактор (для orphan-cleanup) */
  onUploaded?: (url: string) => void;
  /** Блокирует редактирование (например во время Save). */
  disabled?: boolean;
};

export function AdminRichField({
  label,
  value,
  onChange,
  uploadPath = 'catalog/admin/upload-rich-media?type=image',
  tall = false,
  compact = false,
  onUploaded,
  disabled = false,
}: AdminRichFieldProps) {
  const quillRef = useRef<ReactQuillType | null>(null);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const [uploadError, setUploadError] = useState<string | null>(null);

  const modules = useMemo(
    () => ({
      toolbar: disabled
        ? false
        : {
            container: [
              [{ header: [2, 3, false] }],
              ['bold', 'italic', 'underline'],
              [{ list: 'ordered' }, { list: 'bullet' }],
              ['link', 'image'],
              ['clean'],
            ],
            handlers: {
              image: () => {
                if (disabledRef.current) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/jpeg,image/png,image/webp,image/gif';
                input.onchange = () => {
                  const file = input.files?.[0];
                  if (!file) return;
                  void (async () => {
                    setUploadError(null);
                    try {
                      const fd = new FormData();
                      fd.append('file', file);
                      const res = await adminBackendFetch(uploadPath, {
                        method: 'POST',
                        body: fd,
                      });
                      if (!res.ok) {
                        throw new AdminBackendRequestError(
                          await readAdminApiError(res),
                          res.status,
                        );
                      }
                      const data = (await res.json()) as { url: string };
                      const editor = quillRef.current?.getEditor();
                      if (!editor) return;
                      const range = editor.getSelection(true);
                      const index = range?.index ?? editor.getLength();
                      editor.insertEmbed(index, 'image', data.url, 'user');
                      editor.setSelection(index + 1, 0);
                      if (data.url) onUploadedRef.current?.(data.url);
                    } catch (e) {
                      setUploadError(
                        e instanceof AdminBackendRequestError
                          ? e.message
                          : 'Не удалось загрузить изображение',
                      );
                    }
                  })();
                };
                input.click();
              },
            },
          },
    }),
    [uploadPath, disabled],
  );

  const sizeClass = tall ? styles.tall : compact ? styles.compact : '';

  return (
    <div
      className={`${styles.wrap} ${sizeClass} ${disabled ? styles.disabled : ''}`.trim()}
    >
      <span className={styles.label}>{label}</span>
      <div className={styles.editor}>
        <ReactQuill
          forwardedRef={quillRef}
          theme="snow"
          value={value}
          onChange={(html) => {
            if (disabledRef.current) return;
            onChange(html);
          }}
          modules={modules}
          readOnly={disabled}
        />
      </div>
      {uploadError ? (
        <p className={styles.error} role="alert">
          {uploadError}
        </p>
      ) : null}
    </div>
  );
}
