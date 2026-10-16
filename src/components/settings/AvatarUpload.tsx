'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Camera } from 'lucide-react';
import { PSButton } from '@/components/ui/playstake/PSButton';
import { useToast } from '@/components/ui/Toast';
import { getInitials } from '@/lib/utils/format';

const MAX_BYTES = 5 * 1024 * 1024;

interface AvatarUploadProps {
  avatarUrl: string | null;
  name: string;
  onChange: (avatarUrl: string | null) => void;
}

/** Profile photo picker: shows the photo straight away, then uploads it. */
export function AvatarUpload({ avatarUrl, name, onChange }: AvatarUploadProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  // The picked file, shown while it uploads; otherwise the saved photo.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const preview = localPreview ?? avatarUrl;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // let the same file be picked again
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('error', 'Choose an image file (JPG, PNG or WebP).');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast('error', 'That image is over 5MB. Choose a smaller one.');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setLocalPreview(localUrl);
    setBusy('upload');
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await fetch('/api/user/avatar', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast('error', data.error ?? 'Could not upload that photo.');
        return;
      }
      onChange(data.avatarUrl);
      toast('success', 'Profile photo updated.');
    } catch {
      toast('error', 'Could not upload that photo.');
    } finally {
      setLocalPreview(null);
      URL.revokeObjectURL(localUrl);
      setBusy(null);
    }
  }

  async function handleRemove() {
    setBusy('remove');
    try {
      const res = await fetch('/api/user/avatar', { method: 'DELETE' });
      if (!res.ok) {
        toast('error', 'Could not remove your photo.');
        return;
      }
      onChange(null);
      toast('success', 'Profile photo removed.');
    } catch {
      toast('error', 'Could not remove your photo.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ps-muted dark:text-ps-muted-on-dark">
        Profile photo
      </p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== null}
          className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--ps-lime)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-lime)]"
          aria-label="Change profile photo"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob: previews and our own API route
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-mono text-xl font-semibold text-[var(--ps-lime)]">
              {getInitials(name || '?')}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </span>
          {busy === 'upload' && <span className="absolute inset-0 animate-pulse bg-black/30" aria-hidden="true" />}
        </button>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <PSButton
              type="button"
              variant="secondary"
              size="sm"
              loading={busy === 'upload'}
              disabled={busy !== null}
              onClick={() => inputRef.current?.click()}
            >
              {preview ? 'Change photo' : 'Upload photo'}
            </PSButton>
            {preview && (
              <PSButton type="button" variant="ghost" size="sm" loading={busy === 'remove'} disabled={busy !== null} onClick={handleRemove}>
                Remove
              </PSButton>
            )}
          </div>
          <p className="text-xs text-ps-muted dark:text-ps-muted-on-dark">JPG, PNG or WebP, up to 5MB. Other players can see it.</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
