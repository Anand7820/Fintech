import React, { useState, useRef } from 'react';
import { Upload, File, AlertCircle, CheckCircle, RefreshCcw, Sparkles } from 'lucide-react';
import { VerificationStatus } from '@/types/kyc';

interface UploadDropzoneProps {
  status: VerificationStatus;
  progress: number;
  selectedDocId: string | null;
  onSelectTemplate: (type: 'passport' | 'license' | 'utility_bill') => void;
  onCustomFileUpload: (file: File) => void;
  onReset: () => void;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  status,
  progress,
  selectedDocId,
  onSelectTemplate,
  onCustomFileUpload,
  onReset,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const validateAndProcessFile = (file: File) => {
    setDragError(null);
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      setDragError('Invalid file type. Please upload a JPG, PNG, or PDF.');
      return;
    }

    if (file.size > maxSize) {
      setDragError('File size exceeds 10MB limit.');
      return;
    }

    onCustomFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full flex flex-col md:flex-row gap-6 mb-6">
      
      {/* Interactive Dropzone Panel */}
      <div className="flex-1 glass-panel rounded-xl p-6 flex flex-col justify-center min-h-[220px] relative overflow-hidden transition-all duration-300">
        
        {/* Border outline styling depending on status */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={status === 'idle' ? triggerFileInput : undefined}
          className={`h-full border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative group
            ${isDragActive ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700/50 hover:border-slate-500 hover:bg-slate-800/20'}
            ${status === 'uploading' || status === 'processing' ? 'pointer-events-none border-indigo-500/20 bg-indigo-950/5' : ''}
            ${status === 'success' ? 'border-emerald-500/30 bg-emerald-950/5' : ''}
            ${status === 'failed' ? 'border-rose-500/30 bg-rose-950/5' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={handleFileInput}
          />

          {/* Render States */}
          {status === 'idle' && (
            <div className="text-center flex flex-col items-center">
              <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400 mb-3 border border-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Drag & drop document file, or <span className="text-indigo-400 group-hover:underline">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Supports JPG, PNG, PDF up to 10MB
              </p>
              {dragError && (
                <div className="mt-3 flex items-center text-xs text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded border border-rose-500/20">
                  <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                  <span>{dragError}</span>
                </div>
              )}
            </div>
          )}

          {(status === 'uploading' || status === 'processing') && (
            <div className="w-full max-w-sm text-center flex flex-col items-center">
              <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400 mb-3 border border-indigo-500/20 animate-spin">
                <RefreshCcw className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                {status === 'uploading' ? 'Uploading Document...' : 'Extracting OCR & Running Verifications...'}
              </p>
              
              {/* Custom visual progress bar */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full mt-4 overflow-hidden border border-slate-700/50">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 h-full rounded-full transition-all duration-300 relative shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] bg-[size:1rem_1rem] animate-shimmer" />
                </div>
              </div>
              <div className="flex justify-between w-full mt-2 text-xs text-slate-400">
                <span>{progress === 100 ? 'OCR analysis' : 'Uploading...'}</span>
                <span className="font-semibold text-indigo-400">{progress}%</span>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center flex flex-col items-center">
              <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 mb-3 border border-emerald-500/20 animate-bounce">
                <CheckCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">Document Verification Process Complete</p>
              <button
                onClick={(e) => { e.stopPropagation(); onReset(); }}
                className="mt-4 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center border border-slate-700 transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Reset Uploader
              </button>
            </div>
          )}

          {status === 'failed' && (
            <div className="text-center flex flex-col items-center">
              <div className="p-3 bg-rose-500/10 rounded-full text-rose-400 mb-3 border border-rose-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">Verification Failure Detected</p>
              <button
                onClick={(e) => { e.stopPropagation(); onReset(); }}
                className="mt-4 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center border border-slate-700 transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Retry Upload
              </button>
            </div>
          )}
          
          {status === 'warning' && (
            <div className="text-center flex flex-col items-center">
              <div className="p-3 bg-amber-500/10 rounded-full text-amber-400 mb-3 border border-amber-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">Tampering / Warning Detected</p>
              <button
                onClick={(e) => { e.stopPropagation(); onReset(); }}
                className="mt-4 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center border border-slate-700 transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Reset Uploader
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Preconfigured Test Template Panel */}
      <div className="w-full md:w-80 glass-panel rounded-xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-1.5 mb-3 text-slate-200 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>Interactive Test Scenarios</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Click any mock document preset below to immediately simulate the real-time extraction pipeline.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* Passport Success Preset */}
          <button
            onClick={() => onSelectTemplate('passport')}
            disabled={status !== 'idle' && selectedDocId !== 'doc-passport-001'}
            className={`w-full text-left p-3 rounded-lg border transition-all duration-300 flex items-center justify-between group
              ${selectedDocId === 'doc-passport-001' 
                ? 'bg-indigo-950/40 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-600 hover:bg-slate-800/40'}
              ${status !== 'idle' && selectedDocId !== 'doc-passport-001' ? 'opacity-40 pointer-events-none' : ''}
            `}
          >
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-md ${selectedDocId === 'doc-passport-001' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                <File className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">US Passport</div>
                <div className="text-[10px] text-slate-400">Clear verification pass</div>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold uppercase">
              Passed
            </span>
          </button>

          {/* California License Suspected Preset */}
          <button
            onClick={() => onSelectTemplate('license')}
            disabled={status !== 'idle' && selectedDocId !== 'doc-license-002'}
            className={`w-full text-left p-3 rounded-lg border transition-all duration-300 flex items-center justify-between group
              ${selectedDocId === 'doc-license-002' 
                ? 'bg-indigo-950/40 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-600 hover:bg-slate-800/40'}
              ${status !== 'idle' && selectedDocId !== 'doc-license-002' ? 'opacity-40 pointer-events-none' : ''}
            `}
          >
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-md ${selectedDocId === 'doc-license-002' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                <File className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Driver's License</div>
                <div className="text-[10px] text-slate-400">Suspected date tampering</div>
              </div>
            </div>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-semibold uppercase">
              Suspected
            </span>
          </button>

          {/* Utility Bill Failed Preset */}
          <button
            onClick={() => onSelectTemplate('utility_bill')}
            disabled={status !== 'idle' && selectedDocId !== 'doc-bill-003'}
            className={`w-full text-left p-3 rounded-lg border transition-all duration-300 flex items-center justify-between group
              ${selectedDocId === 'doc-bill-003' 
                ? 'bg-indigo-950/40 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-600 hover:bg-slate-800/40'}
              ${status !== 'idle' && selectedDocId !== 'doc-bill-003' ? 'opacity-40 pointer-events-none' : ''}
            `}
          >
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-md ${selectedDocId === 'doc-bill-003' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                <File className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Utility Bill</div>
                <div className="text-[10px] text-slate-400">Expired date limit</div>
              </div>
            </div>
            <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-semibold uppercase">
              Failed
            </span>
          </button>
        </div>
      </div>

    </div>
  );
};
