'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFileViewer } from '@/context/FileViewerContext';

function getFileExtension(filename: string): string {
  const clean = filename.split('?')[0].split('#')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

function detectCategory(
  url: string,
  name?: string,
  mimeType?: string,
): 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'document' {
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('csv'))
      return 'text';
  }

  const ext = getFileExtension(name || url);
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'webm', 'mov', 'ogg', 'm4v', 'ogv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio';
  if (
    [
      'txt',
      'csv',
      'tsv',
      'json',
      'md',
      'js',
      'ts',
      'jsx',
      'tsx',
      'html',
      'css',
      'xml',
      'yml',
      'yaml',
      'log',
    ].includes(ext)
  )
    return 'text';

  return 'document';
}

function formatBytes(bytes?: number | string): string {
  if (!bytes) return '';
  const num = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
  if (isNaN(num) || num <= 0) return '';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileViewerModal() {
  const { isOpen, activeFile } = useFileViewer();
  if (!isOpen || !activeFile) return null;
  return <FileViewerModalContent key={activeFile.url} />;
}

function FileViewerModalContent() {
  const { isOpen, activeFile, files, currentIndex, closeViewer, nextFile, prevFile, setIndex } =
    useFileViewer();

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch text preview when text file is active
  useEffect(() => {
    if (!activeFile) return;

    const category = detectCategory(activeFile.url, activeFile.name, activeFile.type);
    if (category === 'text') {
      let cancelled = false;
      fetch(activeFile.url)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load text content');
          return res.text();
        })
        .then((text) => {
          if (!cancelled) setTextContent(text);
        })
        .catch(() => {
          if (!cancelled)
            setTextContent('Unable to preview text content directly. Please use download.');
        });

      return () => {
        cancelled = true;
      };
    }
  }, [activeFile]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        closeViewer();
      } else if (e.key === 'ArrowRight' && files.length > 1) {
        nextFile();
      } else if (e.key === 'ArrowLeft' && files.length > 1) {
        prevFile();
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z + 0.25, 4));
      } else if (e.key === '-' || e.key === '_') {
        setZoom((z) => Math.max(z - 0.25, 0.5));
      }
    },
    [isOpen, files.length, closeViewer, nextFile, prevFile],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!activeFile) return null;

  const category = detectCategory(activeFile.url, activeFile.name, activeFile.type);
  const ext =
    getFileExtension(activeFile.name || activeFile.url).toUpperCase() || category.toUpperCase();
  const isLoadingText = category === 'text' && textContent === null;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleCopyText = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 text-white backdrop-blur-xl transition-all duration-200 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`File Viewer: ${activeFile.name || 'Document'}`}
    >
      {/* Top Bar Header */}
      <header className="z-20 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-4 py-3">
        <div className="flex items-center space-x-3 overflow-hidden">
          <span className="rounded-md border border-blue-500/30 bg-blue-600/30 px-2.5 py-1 text-xs font-semibold tracking-wide text-blue-400 uppercase">
            {ext}
          </span>
          <div className="truncate">
            <h3
              className="max-w-xs truncate text-sm font-medium text-slate-100 md:max-w-md lg:max-w-xl"
              title={activeFile.name || activeFile.url}
            >
              {activeFile.name || activeFile.url.split('/').pop()}
            </h3>
            {activeFile.size && (
              <p className="text-xs text-slate-400">{formatBytes(activeFile.size)}</p>
            )}
          </div>
          {files.length > 1 && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
              {currentIndex + 1} / {files.length}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {category === 'image' && (
            <div className="mr-1 flex items-center rounded-lg border border-slate-700/60 bg-slate-800/80 p-0.5 sm:mr-2">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="rounded p-1.5 text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white disabled:opacity-40"
                title="Zoom Out (-)"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="rounded px-2 py-1 font-mono text-xs text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white"
                title="Reset Zoom (100%)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 4}
                className="rounded p-1.5 text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white disabled:opacity-40"
                title="Zoom In (+)"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="rounded p-1.5 text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white"
                title="Rotate 90°"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
          )}

          {category === 'video' && (
            <div className="mr-2 hidden items-center rounded-lg border border-slate-700/60 bg-slate-800/80 p-0.5 text-xs sm:flex">
              {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSpeedChange(s)}
                  className={`rounded px-2 py-1 transition-colors ${
                    playbackSpeed === s
                      ? 'bg-blue-600 font-semibold text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}

          {category === 'text' && textContent && (
            <button
              type="button"
              onClick={handleCopyText}
              className="hidden items-center space-x-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 sm:flex"
              title="Copy to clipboard"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
          )}

          {/* Download Link */}
          <a
            href={activeFile.url}
            download={activeFile.name || 'download'}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-transparent p-2 text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            title="Download file"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </a>

          {/* Open in new tab */}
          <a
            href={activeFile.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-transparent p-2 text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            title="Open in new window"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden rounded-lg border border-transparent p-2 text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white sm:inline-flex"
            title="Toggle fullscreen"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isFullscreen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              )}
            </svg>
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={closeViewer}
            className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
            title="Close viewer (Esc)"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Display Body */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {/* Navigation Arrows */}
        {files.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevFile}
              className="absolute top-1/2 left-4 z-30 -translate-y-1/2 transform rounded-full border border-slate-700/80 bg-slate-900/80 p-3 text-slate-200 shadow-2xl backdrop-blur-md transition-all hover:scale-110 hover:bg-slate-800 hover:text-white active:scale-95"
              title="Previous file (Left Arrow)"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={nextFile}
              className="absolute top-1/2 right-4 z-30 -translate-y-1/2 transform rounded-full border border-slate-700/80 bg-slate-900/80 p-3 text-slate-200 shadow-2xl backdrop-blur-md transition-all hover:scale-110 hover:bg-slate-800 hover:text-white active:scale-95"
              title="Next file (Right Arrow)"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        )}

        {/* Content by Category */}
        <div className="flex h-full w-full items-center justify-center overflow-auto">
          {category === 'image' && (
            <div
              className="flex h-full w-full cursor-grab items-center justify-center transition-transform duration-150 ease-out active:cursor-grabbing"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
              onDoubleClick={handleResetZoom}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeFile.url}
                alt={activeFile.name || 'Preview'}
                className="max-h-[85vh] max-w-[90vw] rounded object-contain shadow-2xl transition-opacity duration-200"
                draggable={false}
              />
            </div>
          )}

          {category === 'pdf' && (
            <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
              <iframe
                src={`${activeFile.url}#toolbar=1`}
                title={activeFile.name || 'PDF Document'}
                className="w-full flex-1 rounded-xl border-0"
              />
            </div>
          )}

          {category === 'video' && (
            <div className="flex h-full w-full max-w-4xl items-center justify-center">
              <video
                ref={videoRef}
                src={activeFile.url}
                controls
                autoPlay
                className="max-h-[82vh] max-w-full rounded-xl border border-slate-800/80 bg-black shadow-2xl"
              >
                Your browser does not support HTML5 video preview.
              </video>
            </div>
          )}

          {category === 'audio' && (
            <div className="flex w-full max-w-md flex-col items-center space-y-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20">
                <svg
                  className="h-10 w-10 animate-pulse text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
              <div className="text-center">
                <h4 className="max-w-xs truncate text-base font-semibold text-slate-100">
                  {activeFile.name || 'Audio Track'}
                </h4>
                <p className="mt-1 text-xs tracking-wider text-slate-400 uppercase">{ext} AUDIO</p>
              </div>
              <audio src={activeFile.url} controls className="mt-2 w-full" />
            </div>
          )}

          {category === 'text' && (
            <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/95 font-mono text-xs shadow-2xl sm:text-sm">
              <div className="flex items-center justify-between border-b border-slate-700/80 bg-slate-800/80 px-4 py-2.5 text-slate-400">
                <span>{ext} File Content</span>
                <span>{textContent ? `${textContent.split('\n').length} lines` : ''}</span>
              </div>
              <div className="flex-1 overflow-auto p-4 leading-relaxed whitespace-pre-wrap text-slate-200 select-text">
                {isLoadingText ? (
                  <div className="flex h-48 items-center justify-center text-slate-400">
                    <svg
                      className="mr-3 h-6 w-6 animate-spin text-blue-500"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Loading preview...
                  </div>
                ) : (
                  textContent || 'No preview available'
                )}
              </div>
            </div>
          )}

          {category === 'document' && (
            <div className="flex w-full max-w-md flex-col items-center space-y-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-2xl">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 shadow-lg">
                <svg
                  className="h-10 w-10 text-slate-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="text-base font-semibold text-slate-100">
                  {activeFile.name || 'Document'}
                </h4>
                <p className="mt-1 text-xs tracking-wider text-slate-400 uppercase">{ext} FILE</p>
                {activeFile.size && (
                  <p className="mt-0.5 text-xs text-slate-500">{formatBytes(activeFile.size)}</p>
                )}
              </div>
              <p className="max-w-xs text-xs text-slate-400">
                Inline preview is not supported for this file format. You can download it directly
                or open it in your default desktop viewer.
              </p>
              <div className="flex w-full items-center space-x-3 pt-2">
                <a
                  href={activeFile.url}
                  download={activeFile.name || 'document'}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-center text-xs font-medium text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500"
                >
                  Download File
                </a>
                <a
                  href={activeFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-center text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
                >
                  Open External
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gallery Bottom Thumbnail Strip */}
      {files.length > 1 && (
        <div className="z-20 flex items-center justify-center space-x-2 overflow-x-auto border-t border-slate-800/80 bg-slate-900/90 px-4 py-2.5">
          {files.map((file, idx) => {
            const isSelected = idx === currentIndex;
            const fileCat = detectCategory(file.url, file.name, file.type);
            return (
              <button
                key={file.url + idx}
                type="button"
                onClick={() => setIndex(idx)}
                className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'scale-105 border-blue-500 shadow-md shadow-blue-500/30'
                    : 'border-slate-700 opacity-60 hover:opacity-100'
                }`}
                title={file.name || `File ${idx + 1}`}
              >
                {fileCat === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-800 text-[10px] font-bold text-slate-300 uppercase">
                    {getFileExtension(file.name || file.url) || fileCat}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
