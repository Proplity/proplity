'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface ViewerFile {
  url: string;
  name?: string;
  type?: string;
  size?: number | string;
}

export interface FileViewerContextType {
  isOpen: boolean;
  activeFile: ViewerFile | null;
  files: ViewerFile[];
  currentIndex: number;
  openFile: (file: ViewerFile | string) => void;
  openGallery: (files: (ViewerFile | string)[], initialIndex?: number) => void;
  closeViewer: () => void;
  nextFile: () => void;
  prevFile: () => void;
  setIndex: (index: number) => void;
}

const FileViewerContext = createContext<FileViewerContextType | undefined>(undefined);

function normalizeFile(file: ViewerFile | string): ViewerFile {
  if (typeof file === 'string') {
    const filename = file.split('/').pop()?.split('?')[0] || 'file';
    return { url: file, name: filename };
  }
  return file;
}

export function FileViewerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<ViewerFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openFile = useCallback((file: ViewerFile | string) => {
    const normalized = normalizeFile(file);
    setFiles([normalized]);
    setCurrentIndex(0);
    setIsOpen(true);
  }, []);

  const openGallery = useCallback((fileList: (ViewerFile | string)[], initialIndex = 0) => {
    if (!fileList.length) return;
    const normalized = fileList.map(normalizeFile);
    setFiles(normalized);
    const safeIndex = Math.max(0, Math.min(initialIndex, normalized.length - 1));
    setCurrentIndex(safeIndex);
    setIsOpen(true);
  }, []);

  const closeViewer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const nextFile = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1 < files.length ? prev + 1 : 0));
  }, [files.length]);

  const prevFile = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 >= 0 ? prev - 1 : files.length - 1));
  }, [files.length]);

  const setIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const activeFile = useMemo(() => {
    return files[currentIndex] || null;
  }, [files, currentIndex]);

  const value = useMemo(
    () => ({
      isOpen,
      activeFile,
      files,
      currentIndex,
      openFile,
      openGallery,
      closeViewer,
      nextFile,
      prevFile,
      setIndex,
    }),
    [isOpen, activeFile, files, currentIndex, openFile, openGallery, closeViewer, nextFile, prevFile, setIndex],
  );

  return <FileViewerContext.Provider value={value}>{children}</FileViewerContext.Provider>;
}

export function useFileViewer() {
  const context = useContext(FileViewerContext);
  if (!context) {
    throw new Error('useFileViewer must be used within a FileViewerProvider');
  }
  return context;
}
