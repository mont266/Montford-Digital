import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ProjectFile,
} from '../pages/ClientPortalPage';
import {
  getFileCategory,
  getFileExtension,
  getFileCategoryLabel,
  formatBytes,
  downloadFile,
} from '../lib/fileUtils';
import { supabase } from '../lib/supabaseClient';

export interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: ProjectFile | null;
  allFiles?: ProjectFile[];
  projectName?: string;
  onNavigateFile?: (file: ProjectFile) => void;
  onDeleteFile?: (id: string, filePath: string) => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  isOpen,
  onClose,
  file,
  allFiles = [],
  projectName,
  onNavigateFile,
  onDeleteFile,
}) => {
  // Navigation index
  const currentIndex = useMemo(() => {
    if (!file || allFiles.length === 0) return -1;
    return allFiles.findIndex((f) => f.id === file.id);
  }, [file, allFiles]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allFiles.length - 1;

  // Zoom / image state
  const [zoomScale, setZoomScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);

  // Text / code preview state
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [csvTableView, setCsvTableView] = useState(true);

  // Download & copy states
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [isCopiedText, setIsCopiedText] = useState(false);
  const [docViewerFailed, setDocViewerFailed] = useState(false);

  // Compute public URL
  const publicUrl = useMemo(() => {
    if (!file?.file_path) return '';
    return supabase.storage.from('project_files').getPublicUrl(file.file_path).data.publicUrl;
  }, [file?.file_path]);

  const fileExt = useMemo(() => (file ? getFileExtension(file.file_name) : ''), [file]);
  const category = useMemo(() => (file ? getFileCategory(file.file_name, file.file_type) : 'other'), [file]);

  // Reset viewer adjustments on file change
  useEffect(() => {
    setZoomScale(1);
    setRotation(0);
    setImgDimensions(null);
    setTextContent(null);
    setTextError(null);
    setDocViewerFailed(false);
  }, [file?.id]);

  // Fetch text/code content if category is code/text
  useEffect(() => {
    if (!isOpen || !file || category !== 'code' || !publicUrl) return;

    let isMounted = true;
    setIsTextLoading(true);
    setTextError(null);

    fetch(publicUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((txt) => {
        if (isMounted) {
          setTextContent(txt);
          setIsTextLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error fetching text file content:', err);
          setTextError('Unable to preview text content directly. Please download the file to view.');
          setIsTextLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, file?.id, category, publicUrl]);

  // Keyboard navigation (Escape to close, Arrows to paginate)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev && onNavigateFile) {
        onNavigateFile(allFiles[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && hasNext && onNavigateFile) {
        onNavigateFile(allFiles[currentIndex + 1]);
      }
    },
    [isOpen, onClose, hasPrev, hasNext, currentIndex, allFiles, onNavigateFile]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen || !file) return null;

  const handleDownload = async () => {
    if (!publicUrl || !file) return;
    setIsDownloading(true);
    try {
      await downloadFile(publicUrl, file.file_name);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setIsCopiedLink(true);
      setTimeout(() => setIsCopiedLink(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyText = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setIsCopiedText(true);
      setTimeout(() => setIsCopiedText(false), 2000);
    } catch {
      // fallback
    }
  };

  const handlePrev = () => {
    if (hasPrev && onNavigateFile) {
      onNavigateFile(allFiles[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigateFile) {
      onNavigateFile(allFiles[currentIndex + 1]);
    }
  };

  // CSV parser for formatted table view
  const parsedCsvRows = useMemo(() => {
    if (!textContent || fileExt !== 'csv') return null;
    const lines = textContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    return lines.slice(0, 100).map((line) => {
      // Basic comma splitter respecting simple quotes
      const values: string[] = [];
      let current = '';
      let insideQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });
  }, [textContent, fileExt]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col animate-fade-in select-none text-slate-100"
      role="dialog"
      aria-modal="true"
    >
      {/* --- TOP BAR --- */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        {/* Left info: Icon, Name, Metadata */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Category Icon */}
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
              category === 'image'
                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                : category === 'pdf'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : category === 'code'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : category === 'video' || category === 'audio'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            }`}
          >
            {category === 'image' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ) : category === 'pdf' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ) : category === 'code' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            ) : category === 'video' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : category === 'audio' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-bold text-white truncate leading-snug" title={file.file_name}>
              {file.file_name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
              <span className="text-cyan-400 font-mono text-[11px] font-semibold">
                {getFileCategoryLabel(category, fileExt)}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{formatBytes(file.file_size)}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>
                {file.uploaded_by === 'admin' ? 'Added by Scott' : 'Uploaded by Client'}
              </span>
              {projectName && (
                <>
                  <span aria-hidden="true" className="text-slate-600 hidden sm:inline">·</span>
                  <span className="text-slate-400 truncate max-w-[150px] hidden sm:inline">{projectName}</span>
                </>
              )}
              {allFiles.length > 1 && currentIndex >= 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {currentIndex + 1} of {allFiles.length}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Previous / Next buttons */}
          {allFiles.length > 1 && (
            <div className="hidden sm:flex items-center bg-slate-800 rounded-lg border border-slate-700/80 p-0.5 mr-1">
              <button
                type="button"
                onClick={handlePrev}
                disabled={!hasPrev}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded-md transition-colors"
                title="Previous file (Left Arrow)"
                aria-label="Previous file"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!hasNext}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded-md transition-colors"
                title="Next file (Right Arrow)"
                aria-label="Next file"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Copy Direct Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-2 sm:px-2.5 sm:py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
            title="Copy direct file URL"
          >
            {isCopiedLink ? (
              <>
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="hidden sm:inline text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span className="hidden md:inline">Share Link</span>
              </>
            )}
          </button>

          {/* Open Original in New Tab */}
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 sm:px-2.5 sm:py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
            title="Open in new browser tab"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="hidden md:inline">New Tab</span>
          </a>

          {/* Primary Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="px-3 sm:px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-950/30 transition-all cursor-pointer min-h-[34px]"
            title={`Download ${file.file_name}`}
          >
            {isDownloading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download</span>
              </>
            )}
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-lg min-h-[34px] min-w-[34px] flex items-center justify-center transition-colors ml-1"
            title="Close viewer (ESC)"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </header>

      {/* --- MAIN PREVIEW STAGE --- */}
      <main className="flex-1 overflow-auto flex items-center justify-center p-3 sm:p-6 relative bg-slate-950">
        {/* IMAGE PREVIEW */}
        {category === 'image' && (
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            {/* Image zoom toolbar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 backdrop-blur border border-slate-750 px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.max(0.25, s - 0.25))}
                className="p-1 hover:text-cyan-400 transition-colors"
                title="Zoom Out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="font-mono text-cyan-300 min-w-[48px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.min(3, s + 0.25))}
                className="p-1 hover:text-cyan-400 transition-colors"
                title="Zoom In"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <div className="w-px h-3.5 bg-slate-750" />
              <button
                type="button"
                onClick={() => {
                  setZoomScale(1);
                  setRotation(0);
                }}
                className="text-[11px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded transition-colors"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1 hover:text-cyan-400 transition-colors"
                title="Rotate 90°"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              {imgDimensions && (
                <>
                  <div className="w-px h-3.5 bg-slate-750" />
                  <span className="text-[10px] text-slate-500 font-mono">
                    {imgDimensions.width} × {imgDimensions.height} px
                  </span>
                </>
              )}
            </div>

            {/* Scrollable image container */}
            <div className="max-w-full max-h-[82vh] overflow-auto flex items-center justify-center p-2">
              <img
                src={publicUrl}
                alt={file.file_name}
                onLoad={(e) => {
                  const target = e.currentTarget;
                  setImgDimensions({ width: target.naturalWidth, height: target.naturalHeight });
                }}
                style={{
                  transform: `scale(${zoomScale}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-800"
              />
            </div>
          </div>
        )}

        {/* PDF PREVIEW */}
        {category === 'pdf' && (
          <div className="w-full h-full max-w-5xl flex flex-col bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-rose-300 font-medium">
                <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF Document Viewer
              </span>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 underline text-xs"
              >
                Open fullscreen in new tab &rarr;
              </a>
            </div>
            <div className="flex-1 w-full min-h-[500px] h-[75vh]">
              <iframe
                src={`${publicUrl}#toolbar=1&navpanes=0`}
                title={file.file_name}
                className="w-full h-full border-0 bg-slate-900"
              />
            </div>
          </div>
        )}

        {/* CODE / TEXT / CSV / JSON PREVIEW */}
        {category === 'code' && (
          <div className="w-full h-full max-w-4xl flex flex-col bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
            {/* Header toolbar */}
            <div className="px-4 py-2.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-mono font-bold uppercase">{fileExt || 'TEXT'}</span>
                {parsedCsvRows && (
                  <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setCsvTableView(true)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        csvTableView ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Table View
                    </button>
                    <button
                      type="button"
                      onClick={() => setCsvTableView(false)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        !csvTableView ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Raw Code
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {textContent && (
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1 transition-colors"
                  >
                    {isCopiedText ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-emerald-300">Copied</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        <span>Copy Content</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Content view */}
            <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-200 leading-relaxed custom-scrollbar max-h-[75vh]">
              {isTextLoading ? (
                <div className="py-20 text-center text-slate-400 space-y-2">
                  <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading document content...</p>
                </div>
              ) : textError ? (
                <div className="p-8 text-center text-slate-400 space-y-4">
                  <p className="text-amber-400">{textError}</p>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold"
                  >
                    Download File to View Locally
                  </button>
                </div>
              ) : parsedCsvRows && csvTableView ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                        {parsedCsvRows[0]?.map((col, idx) => (
                          <th key={idx} className="p-2.5 font-semibold font-sans">
                            {col || `Col ${idx + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {parsedCsvRows.slice(1).map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-slate-900/50">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="p-2.5 text-slate-300 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap select-text">{textContent || 'File is empty.'}</pre>
              )}
            </div>
          </div>
        )}

        {/* VIDEO PREVIEW */}
        {category === 'video' && (
          <div className="max-w-4xl w-full flex flex-col items-center justify-center">
            <video
              src={publicUrl}
              controls
              className="max-h-[75vh] w-auto max-w-full rounded-xl shadow-2xl border border-slate-800 bg-black"
            >
              Your browser does not support HTML5 video preview.
            </video>
          </div>
        )}

        {/* AUDIO PREVIEW */}
        {category === 'audio' && (
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-bold text-base truncate">{file.file_name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{formatBytes(file.file_size)}</p>
            </div>
            <audio src={publicUrl} controls className="w-full mt-2" />
          </div>
        )}

        {/* OFFICE DOCUMENT PREVIEW (Word / Excel / PowerPoint) */}
        {category === 'document' && (
          <div className="w-full h-full max-w-5xl flex flex-col bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-blue-300 font-medium">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Document Preview ({fileExt.toUpperCase()})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold text-xs flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download file directly</span>
                </button>
              </div>
            </div>

            {!docViewerFailed ? (
              <div className="flex-1 w-full min-h-[500px] h-[75vh] relative bg-slate-950">
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(publicUrl)}&embedded=true`}
                  title={file.file_name}
                  className="w-full h-full border-0"
                  onError={() => setDocViewerFailed(true)}
                />
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 space-y-4 my-auto">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">{file.file_name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatBytes(file.file_size)} · Open with your native office application
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-sm rounded-lg shadow-lg shadow-cyan-950/20 transition-all inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Document</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ARCHIVE / OTHER / UNSUPPORTED BINARY */}
        {(category === 'archive' || category === 'other') && (
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-5">
            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto shadow-inner">
              {category === 'archive' ? (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              ) : (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-white font-bold text-lg truncate px-2" title={file.file_name}>
                {file.file_name}
              </h3>
              <p className="text-xs text-slate-400">
                {getFileCategoryLabel(category, fileExt)} · {formatBytes(file.file_size)}
              </p>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed px-4">
              This file type cannot be previewed directly inside the web browser. Download the file to open it with your local software.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full sm:w-auto px-6 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-sm rounded-lg shadow-lg shadow-cyan-950/20 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download File</span>
                  </>
                )}
              </button>

              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
              >
                <span>Direct URL</span>
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            {file.uploaded_by === 'client' && onDeleteFile && (
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDeleteFile(file.id, file.file_path);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Delete this file from project
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- FOOTER (Navigation hints on mobile/desktop) --- */}
      <footer className="bg-slate-900/90 border-t border-slate-800/80 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">Use Arrow keys &larr; &rarr; to browse files</span>
          <span className="hidden sm:inline">·</span>
          <span>Press ESC to exit viewer</span>
        </div>

        {allFiles.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={!hasPrev}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-750 disabled:opacity-30 rounded text-slate-300 transition-colors"
            >
              &larr; Prev
            </button>
            <span className="font-mono text-slate-400">
              {currentIndex + 1} / {allFiles.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasNext}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-750 disabled:opacity-30 rounded text-slate-300 transition-colors"
            >
              Next &rarr;
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};
