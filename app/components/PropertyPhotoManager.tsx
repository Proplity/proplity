'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Camera,
  Upload,
  Trash2,
  CheckCircle,
  Star,
  X,
  Video,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { uploadFile, uploadsEnabled } from '@/lib/uploadClient';
import { api } from '@/lib/apiClient';
import type { PropertyDetail } from '@/lib/api/types';

interface PropertyPhotoManagerProps {
  property: PropertyDetail;
  onUpdated: () => void;
  canManage: boolean;
}

export function PropertyPhotoManager({
  property,
  onUpdated,
  canManage,
}: PropertyPhotoManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal working state:
  const [imageUrl, setImageUrl] = useState<string | null>(property.imageUrl ?? null);
  const [exteriorPhotoUrl, setExteriorPhotoUrl] = useState<string | null>(
    property.exteriorPhotoUrl ?? null,
  );
  const [photoUrls, setPhotoUrls] = useState<string[]>(property.photoUrls ?? []);
  const [video360Url, setVideo360Url] = useState<string>(property.video360Url ?? '');

  const openModal = () => {
    setImageUrl(property.imageUrl ?? null);
    setExteriorPhotoUrl(property.exteriorPhotoUrl ?? null);
    setPhotoUrls(property.photoUrls ?? []);
    setVideo360Url(property.video360Url ?? '');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving || uploading) return;
    setIsModalOpen(false);
  };

  const handleUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    if (!uploadsEnabled()) {
      setErrorMessage(
        'Cloud storage is not configured in this environment. Photo uploads require Cloudinary environment variables.',
      );
      return;
    }

    setErrorMessage(null);
    setUploading(true);
    try {
      const uploadedFiles = await Promise.all(files.map((file) => uploadFile(file, 'properties')));
      const newUrls = uploadedFiles.map((u) => u.url);

      // If no cover photo is set yet, default the first uploaded photo as cover
      if (!imageUrl && newUrls.length > 0) {
        setImageUrl(newUrls[0]);
      }

      setPhotoUrls((prev) => [...prev, ...newUrls]);
      toast.success(
        `${uploadedFiles.length} photo${uploadedFiles.length === 1 ? '' : 's'} uploaded`,
      );
    } catch {
      setErrorMessage('One or more photos failed to upload. Please try again.');
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = (urlToRemove: string) => {
    setPhotoUrls((prev) => prev.filter((url) => url !== urlToRemove));
    if (imageUrl === urlToRemove) {
      setImageUrl(null);
    }
    if (exteriorPhotoUrl === urlToRemove) {
      setExteriorPhotoUrl(null);
    }
  };

  const handleSetCover = (url: string) => {
    setImageUrl(url);
    if (!photoUrls.includes(url)) {
      setPhotoUrls((prev) => [url, ...prev]);
    }
    toast.info('Set as cover photo');
  };

  const handleSetExterior = (url: string) => {
    setExteriorPhotoUrl(url === exteriorPhotoUrl ? null : url);
    if (url !== exteriorPhotoUrl && !photoUrls.includes(url)) {
      setPhotoUrls((prev) => [...prev, url]);
    }
    toast.info(url === exteriorPhotoUrl ? 'Cleared exterior photo' : 'Set as exterior photo');
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);

    // Collect all distinct photos including cover and exterior
    const distinctPhotos = Array.from(
      new Set([imageUrl, exteriorPhotoUrl, ...photoUrls].filter((u): u is string => Boolean(u))),
    );

    try {
      await api.properties.update(property.id, {
        imageUrl: imageUrl || null,
        exteriorPhotoUrl: exteriorPhotoUrl || null,
        photoUrls: distinctPhotos,
        video360Url: video360Url.trim() || null,
      });

      toast.success('Listing photos and media updated');
      setIsModalOpen(false);
      onUpdated();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Failed to update photos';
      setErrorMessage(msg || 'Failed to update photos');
      toast.error('Could not save photos');
    } finally {
      setSaving(false);
    }
  };

  const allDisplayPhotos = Array.from(
    new Set(
      [property.imageUrl, property.exteriorPhotoUrl, ...(property.photoUrls ?? [])].filter(
        (u): u is string => Boolean(u),
      ),
    ),
  );

  return (
    <>
      {/* ── Dashboard Card ── */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-6">
          <div>
            <h2 className="font-semibold text-gray-900">Photos & Media</h2>
            <p className="text-sm text-gray-500">
              {allDisplayPhotos.length === 0
                ? 'No photos uploaded yet.'
                : `${allDisplayPhotos.length} photo${allDisplayPhotos.length === 1 ? '' : 's'} attached to this listing.`}
              {property.video360Url && ' · 360° virtual tour included.'}
            </p>
          </div>
          {canManage && (
            <button
              onClick={openModal}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Camera className="h-4 w-4 text-gray-500" />
              Manage Photos
            </button>
          )}
        </div>

        <div className="p-6">
          {allDisplayPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-10 text-center">
              <div className="mb-3 rounded-full bg-gray-50 p-3 text-gray-400">
                <ImageIcon className="h-8 w-8" />
              </div>
              <p className="text-sm font-medium text-gray-700">No photos uploaded</p>
              <p className="mt-1 max-w-sm text-xs text-gray-400">
                Showcase this listing with room and exterior photos to attract prospective tenants.
              </p>
              {canManage && (
                <button
                  onClick={openModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Add Photos
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {allDisplayPhotos.map((url, index) => {
                const isCover = url === property.imageUrl;
                const isExterior = url === property.exteriorPhotoUrl;
                return (
                  <div
                    key={`${url}-${index}`}
                    className="group relative aspect-4/3 overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                  >
                    <ImageWithFallback
                      src={url}
                      alt={`${property.name} photo ${index + 1}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {isCover && (
                        <span className="rounded-md bg-blue-600/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs backdrop-blur-xs">
                          Cover
                        </span>
                      )}
                      {isExterior && (
                        <span className="rounded-md bg-emerald-600/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs backdrop-blur-xs">
                          Exterior
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Photo Management Modal ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={closeModal}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage Photos & Media</h3>
                <p className="text-xs text-gray-500">
                  Update cover image, upload gallery photos, or link a 360° virtual tour.
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={saving || uploading}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Upload Drop Area */}
              <div>
                <label
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors ${
                    uploading
                      ? 'cursor-not-allowed border-blue-300 bg-blue-50/50'
                      : 'border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleUploadPhotos}
                    disabled={uploading || saving}
                    className="hidden"
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <p className="mt-2 text-sm font-medium text-blue-700">Uploading photos…</p>
                      <p className="text-xs text-blue-500">Optimizing and storing safely</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <div className="rounded-full bg-blue-50 p-3 text-blue-600">
                        <Upload className="h-6 w-6" />
                      </div>
                      <p className="mt-2 text-sm font-medium text-gray-700">
                        Click or drag to upload room & exterior photos
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        PNG, JPG, or WEBP up to 10MB each
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {/* Photos List / Grid */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">
                    Current Listing Photos (
                    {
                      Array.from(
                        new Set(
                          [imageUrl, exteriorPhotoUrl, ...photoUrls].filter((u): u is string =>
                            Boolean(u),
                          ),
                        ),
                      ).length
                    }
                    )
                  </h4>
                  <span className="text-xs text-gray-400">
                    Hover a photo to set as Cover or Exterior
                  </span>
                </div>

                {Array.from(
                  new Set(
                    [imageUrl, exteriorPhotoUrl, ...photoUrls].filter((u): u is string =>
                      Boolean(u),
                    ),
                  ),
                ).length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">
                    No photos currently selected. Upload some above!
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {Array.from(
                      new Set(
                        [imageUrl, exteriorPhotoUrl, ...photoUrls].filter((u): u is string =>
                          Boolean(u),
                        ),
                      ),
                    ).map((url, i) => {
                      const isCover = url === imageUrl;
                      const isExterior = url === exteriorPhotoUrl;
                      return (
                        <div
                          key={`modal-${url}-${i}`}
                          className={`group relative aspect-4/3 overflow-hidden rounded-xl border bg-gray-100 ${
                            isCover ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-200'
                          }`}
                        >
                          <ImageWithFallback
                            src={url}
                            alt={`Photo ${i + 1}`}
                            className="h-full w-full object-cover"
                          />

                          {/* Badges */}
                          <div className="absolute top-2 left-2 flex flex-col gap-1">
                            {isCover && (
                              <span className="flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs">
                                <Star className="h-3 w-3 fill-current" /> Cover
                              </span>
                            )}
                            {isExterior && (
                              <span className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs">
                                <CheckCircle className="h-3 w-3" /> Exterior
                              </span>
                            )}
                          </div>

                          {/* Hover action overlay */}
                          <div className="absolute inset-0 flex flex-col justify-between bg-black/60 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(url)}
                                className="rounded-lg bg-red-600/90 p-1.5 text-white hover:bg-red-700"
                                title="Remove photo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              {!isCover && (
                                <button
                                  type="button"
                                  onClick={() => handleSetCover(url)}
                                  className="w-full rounded bg-blue-600 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                >
                                  Set as Cover
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSetExterior(url)}
                                className={`w-full rounded py-1 text-xs font-medium ${
                                  isExterior
                                    ? 'bg-gray-700 text-white hover:bg-gray-800'
                                    : 'bg-white text-gray-800 hover:bg-gray-100'
                                }`}
                              >
                                {isExterior ? 'Unset Exterior' : 'Set as Exterior'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 360 Virtual Tour Link */}
              <div className="border-t border-gray-100 pt-4">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                  <Video className="h-4 w-4 text-gray-500" />
                  360° Virtual Tour / Video URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/tour or video URL"
                  value={video360Url}
                  onChange={(e) => setVideo360Url(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Link to a 360° walkthrough, Matterport tour, or hosted video for this property.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving || uploading}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  'Save Photos & Media'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
